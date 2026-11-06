import {
  combineCandidates,
  selectSessionCandidates,
} from '../../modules/agents';
import { mergeCandidates, findFactConflicts } from '../../modules/facts';
import type { WorkRunRecord } from '../../modules/processing';
import type {
  FieldDefinition,
  WorkFacts,
  AgentSessionContext,
} from '@anyko/contracts';
import type { WorkSummary } from '../../modules/works';
import type { WorkDependencies } from './ports';
import { callModel } from './model-call';

export interface ContinuationSource {
  id: string;
  filename: string;
  digest: string;
  text: string;
  visuals: { path: string; description: string }[];
}

/** One entry point for continuing a logical work session; transport never owns its context. */
export function createWorkContinuation(deps: WorkDependencies) {
  return async (input: {
    run: WorkRunRecord;
    config: Awaited<ReturnType<WorkDependencies['settings']['connection']>>;
    fields: FieldDefinition[];
    candidates: WorkFacts['candidates'];
    sources: ContinuationSource[];
    failures: number;
    completed: number;
    signal: AbortSignal;
    current(): Promise<WorkSummary>;
  }) => {
    const { run } = input;
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await deps.locks.run(
        `work:${run.workspaceId}:${run.workId}`,
        async () => {
          const work = await input.current();
          const facts = await deps.facts.get(run.workspaceId, run.workId);
          const session = await deps.sessions.ensure(
            run.workspaceId,
            run.workId,
          );
          const threadId = crypto.randomUUID();
          await deps.processing.thread(run.workspaceId, run.workId, threadId);
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
      let output: Awaited<ReturnType<typeof deps.agents.reconcile>> | undefined;
      try {
        if (!input.sources.length) throw new Error('NO_READABLE_SOURCES');
        await deps.processing.step(run, {
          stage: 'reconciliation',
          status: 'running',
        });
        await deps.works.event(
          run.workspaceId,
          run.workId,
          'processing.changed',
        );
        const assertCurrent = async () => {
          input.signal.throwIfAborted();
          if ((await input.current()).revision !== snapshot.work.revision)
            throw new Error('CONTEXT_REVISION_CHANGED');
        };
        output = await callModel({
          logger: deps.logger,
          callId: snapshot.threadId,
          runId: run.id,
          correlationId: run.correlationId,
          stage: 'reconciliation',
          provider: input.config.connection.id,
          model: input.config.extractionModel,
          execute: () =>
            deps.agents.reconcile({
              sessionId: snapshot.session.id,
              threadId: snapshot.threadId,
              resource: `${run.workspaceId}:${run.workId}`,
              modelId: input.config.extractionModel,
              connection: input.config.connection,
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
      } catch {
        input.signal.throwIfAborted();
        await input.current();
      }
      const accepted = await deps.locks.run(
        `work:${run.workspaceId}:${run.workId}`,
        async () => {
          const work = await input.current();
          if (work.revision !== snapshot.work.revision && attempt === 0)
            return false;
          let validOutput =
            work.revision === snapshot.work.revision ? output : undefined;
          await deps.transaction(
            async ({ facts, works, processing, sessions }) => {
              // This CAS takes a row lock until commit; a reconciler cannot replace the attempt mid-acceptance.
              await processing.fence(run);
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
              if (validOutput && run.settingsRevision !== null) {
                const context: AgentSessionContext = {
                  version: 1,
                  promptVersion: 'work-context-v1',
                  workRevision: work.revision + 1,
                  inputRevision: work.inputRevision,
                  settingsRevision: run.settingsRevision,
                  summary: validOutput.summary,
                  documents: input.sources.map(({ id, digest }) => ({
                    id,
                    digest,
                  })),
                  missingFields: input.fields
                    .filter((f) => next.values[f.key] === null)
                    .map((f) => f.key),
                  conflictFields: findFactConflicts(next).filter((key) =>
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
              await processing.step(run, {
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
              await processing.finish(
                run,
                input.completed === 0
                  ? 'failed'
                  : input.failures || !validOutput
                    ? 'partial'
                    : 'succeeded',
              );
              await works.event(run.workspaceId, run.workId, 'facts.changed');
            },
          );
          return true;
        },
      );
      if (accepted) return;
    }
  };
}
