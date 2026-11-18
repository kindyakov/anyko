import {
  type AgentSessionContext,
  combineCandidates,
  type FieldDefinition,
  selectSessionCandidates,
  type WorkFacts,
} from '../../modules/agents';
import type { DocumentAnalysis } from '../../modules/documents';
import { findFactDiscrepancies, mergeCandidates } from '../../modules/facts';
import type { WorkAttempt } from '../../modules/processing';
import type { WorkSummary } from '../../modules/works';
import { isAppError } from '../../platform/errors';
import type { WorkDependencies } from '../work-dependencies';
import { workLockKey } from '../work-guards';

import { locateEvidence } from './locate-evidence';
import { callModel } from './model-call';

export interface ContinuationSource {
  id: string;
  filename: string;
  digest: string;
  text: string;
  pdfOcr?: DocumentAnalysis['pdfOcr'];
  visuals: { path: string; description: string }[];
}

/** One entry point for continuing a logical work session; transport never owns its context. */
export function createWorkContinuation(deps: WorkDependencies) {
  return async (input: {
    attempt: WorkAttempt;
    settingsRevision: number | null;
    readConnection(): ReturnType<
      WorkDependencies['connections']['internal']['connection']
    >;
    fields: FieldDefinition[];
    candidates: WorkFacts['candidates'];
    sources: ContinuationSource[];
    failures: number;
    completed: number;
    signal: AbortSignal;
    current(): Promise<WorkSummary>;
  }) => {
    const { attempt: workAttempt, settingsRevision } = input;
    const { run } = workAttempt;
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await deps.locks.run(
        workLockKey(run.workspaceId, run.workId),
        async () => {
          const work = await input.current();
          const facts = await deps.facts.internal.get(
            run.workspaceId,
            run.workId,
          );
          const session = await deps.agents.internal.ensure(
            run.workspaceId,
            run.workId,
          );
          const threadId = deps.newId();
          await deps.processing.internal.thread(
            run.workspaceId,
            run.workId,
            threadId,
          );
          return { work, facts, session, threadId };
        },
      );
      const candidates = combineCandidates(
        input.candidates,
        snapshot.facts.candidates.filter(
          (c) =>
            c.origin !== 'context' &&
            c.evidence.every((e) => run.documentIds.includes(e.documentId)) &&
            c.evidence.some(
              (e) =>
                !input.sources.some((source) => source.id === e.documentId),
            ),
        ),
      );
      let output:
        Awaited<ReturnType<typeof deps.agents.model.reconcile>> | undefined;
      try {
        if (!input.sources.length) throw new Error('NO_READABLE_SOURCES');
        await workAttempt.step({
          stage: 'reconciliation',
          status: 'running',
        });
        await deps.works.internal.event(
          run.workspaceId,
          run.workId,
          'processing.changed',
        );
        const assertCurrent = async () => {
          input.signal.throwIfAborted();
          await input.readConnection();
          if ((await input.current()).revision !== snapshot.work.revision)
            throw new Error('CONTEXT_REVISION_CHANGED');
        };
        const config = await input.readConnection();
        output = await callModel({
          logger: deps.logger,
          callId: snapshot.threadId,
          runId: run.id,
          correlationId: run.correlationId,
          stage: 'reconciliation',
          provider: config.connection.id,
          model: config.extractionModel,
          execute: () =>
            deps.agents.model.reconcile({
              sessionId: snapshot.session.id,
              threadId: snapshot.threadId,
              resource: `${run.workspaceId}:${run.workId}`,
              modelId: config.extractionModel,
              connection: config.connection,
              fields: input.fields,
              workRevision: snapshot.work.revision,
              previousContext: snapshot.session.context,
              facts: snapshot.facts,
              candidates,
              documents: input.sources.map(
                ({ id, filename, digest, visuals }) => ({
                  id,
                  filename,
                  digest,
                  images: visuals.map((v) => v.path),
                }),
              ),
              signal: input.signal,
              assertCurrent,
              readSource: async (documentId, imagePath) => {
                await assertCurrent();
                const source = input.sources.find((s) => s.id === documentId);
                if (!source) throw new Error('SOURCE_NOT_ALLOWED');
                const text =
                  imagePath === null
                    ? source.text
                    : source.visuals.find((v) => v.path === imagePath)
                        ?.description;
                if (text === undefined) throw new Error('SOURCE_NOT_ALLOWED');
                return text;
              },
            }),
        });
        output.candidates = locateEvidence(output.candidates, input.sources);
      } catch (error) {
        if (isAppError(error) && error.code === 'CONNECTION_REVOKED')
          throw error;
        await input.readConnection();
        input.signal.throwIfAborted();
        await input.current();
      }
      const accepted = await deps.locks.run(
        workLockKey(run.workspaceId, run.workId),
        async () => {
          const work = await input.current();
          if (work.revision !== snapshot.work.revision && attempt === 0)
            return false;
          let validOutput =
            work.revision === snapshot.work.revision ? output : undefined;
          await workAttempt.write(async (tx, attemptWrite) => {
            const facts = deps.facts.in(tx).internal;
            const works = deps.works.in(tx).internal;
            const sessions = deps.agents.in(tx).internal;
            const existing = await facts.get(run.workspaceId, run.workId);
            const selection = selectSessionCandidates(
              candidates,
              existing.candidates,
              validOutput?.candidates ?? [],
            );
            if (!selection.contextAccepted) validOutput = undefined;
            const next = mergeCandidates(
              existing,
              selection.candidates,
              work.confirmedRevision === work.revision,
            );
            // A failed optional stage must not erase known values solely because its proposals exceed the budget.
            if (!validOutput)
              for (const field of input.fields) {
                if (!selection.candidates.some((c) => c.field === field.key))
                  next.values[field.key] = existing.values[field.key];
              }
            await facts.save(run.workspaceId, run.workId, next);
            await works.touch(run.workspaceId, run.workId, {});
            if (validOutput && settingsRevision !== null) {
              const context: AgentSessionContext = {
                version: 1,
                promptVersion: 'work-context-v1',
                workRevision: work.revision + 1,
                inputRevision: work.inputRevision,
                settingsRevision,
                summary: validOutput.summary,
                documents: input.sources.map(({ id, digest }) => ({
                  id,
                  digest,
                })),
                missingFields: input.fields
                  .filter((f) => next.values[f.key] === null)
                  .map((f) => f.key),
                // Снимок сессии фиксирует расхождения на момент сохранения этой редакции.
                conflictFields: findFactDiscrepancies(next).filter((key) =>
                  input.fields.some((f) => f.key === key),
                ),
              };
              await sessions.accept({
                workspaceId: run.workspaceId,
                workId: run.workId,
                sessionId: snapshot.session.id,
                expectedRevision: snapshot.session.revision,
                runId: run.id,
                threadId: snapshot.threadId,
                context,
                output: {
                  summary: validOutput.summary,
                  candidates: validOutput.candidates,
                },
              });
            }
            await attemptWrite.step({
              stage: 'reconciliation',
              status: validOutput ? 'succeeded' : 'failed',
              ...(!validOutput
                ? {
                    errorCode:
                      work.revision !== snapshot.work.revision
                        ? 'CONTEXT_REVISION_CHANGED'
                        : 'CONTEXT_RECONCILIATION_FAILED',
                  }
                : { usage: validOutput.usage }),
            });
            await attemptWrite.finish({
              status:
                input.completed === 0
                  ? 'failed'
                  : input.failures || !validOutput
                    ? 'partial'
                    : 'succeeded',
            });
            await works.event(run.workspaceId, run.workId, 'facts.changed');
          });
          return true;
        },
      );
      if (accepted) return;
    }
  };
}
