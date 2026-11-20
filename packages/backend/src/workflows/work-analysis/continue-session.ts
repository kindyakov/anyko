import { LlmError } from '@anyko/llm';

import {
  type AgentSessionContext,
  type FieldDefinition,
} from '../../modules/agents';
import { candidatesForContext, type WorkFacts } from '../../modules/facts';
import type { WorkAttempt } from '../../modules/processing';
import type { WorkSummary } from '../../modules/works';
import { isAppError } from '../../platform/errors';
import type { FieldKey } from '../../profiles/bfl/fields';
import type { WorkDependencies } from '../work-dependencies';
import { logWorkFailure } from '../work-execution/failure';
import { analysisContextRevision } from '../work-execution/run-state';
import { guardWorkRevision, workLockKey } from '../work-guards';

import {
  type ChecklistAnalysisSource,
  validateChecklistSuggestions,
} from './checklist-suggestions';
import { locateEvidence } from './locate-evidence';
import { callModel } from './model-call';

export interface ContinuationSource extends ChecklistAnalysisSource {
  filename: string;
  digest: string;
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
    excludedFields?: ReadonlySet<FieldKey> | undefined;
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
        async (signal) => {
          const work = await input.current();
          const threadId = deps.newId();
          return workAttempt.write(async (tx) => {
            await guardWorkRevision(
              deps.works.in(tx).internal,
              run,
              work.revision,
              signal,
            );
            const facts = await deps.facts.in(tx).queries.forAnalysis(run);
            const session = await deps.agents
              .in(tx)
              .internal.ensure(run.workspaceId, run.workId);
            await deps.processing
              .in(tx)
              .internal.thread(run.workspaceId, run.workId, threadId);
            const requirements = await deps.templateRequirements(
              work.packageVersion,
            );
            return { work, facts, session, threadId, requirements };
          }, signal);
        },
        input.signal,
      );
      const candidates = candidatesForContext(
        input.candidates,
        snapshot.facts.candidates,
        run.documentIds,
        input.sources.map(({ id }) => id),
      );
      let output:
        Awaited<ReturnType<typeof deps.agents.model.reconcile>> | undefined;
      const historyRef = {
        workspaceId: run.workspaceId,
        workId: run.workId,
        runId: run.id,
        sessionId: snapshot.session.id,
      };
      const interaction = {
        interactionId: snapshot.threadId,
        stage: 'reconciliation' as const,
      };
      const history = deps.agents.internal.history.record(historyRef);
      let reconciliationError: string | undefined;
      let reconciliationCause: unknown;
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
          if (
            analysisContextRevision(await input.current()) !==
            analysisContextRevision(snapshot.work)
          )
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
              traceTool: (event) => history.tool({ ...interaction, ...event }),
              observe: history.observe({
                ...interaction,
                provider: config.connection.id,
                model: config.extractionModel,
              }),
              sessionId: snapshot.session.id,
              threadId: snapshot.threadId,
              resource: `${run.workspaceId}:${run.workId}`,
              modelId: config.extractionModel,
              connection: config.connection,
              fields: input.fields,
              checklistRequirements: snapshot.requirements,
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
        output = undefined;
        reconciliationCause = error;
        reconciliationError =
          error instanceof LlmError
            ? error.code
            : 'CONTEXT_RECONCILIATION_FAILED';
        if (isAppError(error) && error.code === 'CONNECTION_REVOKED')
          throw error;
        await input.readConnection();
        input.signal.throwIfAborted();
        await input.current();
      }
      const supersededProposals = () =>
        (output?.candidates ?? []).map((candidate) => ({
          stage: 'reconciliation',
          candidate,
          status: 'superseded',
        }));
      const accepted = await deps.locks.run(
        workLockKey(run.workspaceId, run.workId),
        async (signal) => {
          const work = await input.current();
          const contextChanged =
            analysisContextRevision(work) !==
            analysisContextRevision(snapshot.work);
          if (contextChanged && attempt === 0) {
            await workAttempt.write(
              (tx) =>
                deps.agents.in(tx).internal.history.outcome(historyRef, {
                  ...interaction,
                  status: 'superseded',
                  output: JSON.stringify({
                    proposalOutcomes: supersededProposals(),
                  }),
                  errorCode: 'CONTEXT_REVISION_CHANGED',
                }),
              signal,
            );
            return false;
          }
          let validOutput = contextChanged ? undefined : output;
          await workAttempt.write(async (tx, attemptWrite) => {
            const facts = deps.facts.in(tx).commands;
            const works = deps.works.in(tx).internal;
            const sessions = deps.agents.in(tx).internal;
            await guardWorkRevision(works, run, work.revision, signal, 'draft');
            const acceptedFacts = await facts.acceptRunCandidates({
              workspaceId: run.workspaceId,
              workId: run.workId,
              fields: input.fields.map(({ key }) => key),
              excludedFields: input.excludedFields,
              confirmed: work.confirmedRevision === work.revision,
              preserveExisting: run.automaticUpload === true,
              candidates,
              ...(validOutput && { contextCandidates: validOutput.candidates }),
            });
            if (!acceptedFacts.contextAccepted) validOutput = undefined;
            const suggestions = validOutput?.checklistSuggestions;
            if (suggestions && snapshot.requirements.length) {
              const documents = await works.documents(
                run.workspaceId,
                run.workId,
              );
              const sources = input.sources.filter((source) =>
                documents.some(
                  (row) =>
                    !row.deleted &&
                    row.id === source.id &&
                    row.ocrRevision === source.ocrRevision,
                ),
              );
              await works.replaceChecklistSuggestions(
                run.workspaceId,
                run.workId,
                sources.map(({ id }) => id),
                validateChecklistSuggestions(
                  snapshot.requirements,
                  sources,
                  suggestions,
                ),
              );
            }
            await sessions.history.outcome(historyRef, {
              ...interaction,
              status: validOutput ? 'accepted' : 'rejected',
              output: JSON.stringify({
                summary: validOutput?.summary,
                proposalOutcomes: [
                  ...acceptedFacts.proposalOutcomes,
                  ...(contextChanged ? supersededProposals() : []),
                ],
                missingFields: acceptedFacts.missingFields,
                discrepancyFields: acceptedFacts.discrepancyFields,
              }),
              ...(!validOutput && {
                errorCode:
                  reconciliationError ?? 'CONTEXT_PROPOSALS_NOT_ACCEPTED',
              }),
            });
            if (validOutput && settingsRevision !== null) {
              const context: AgentSessionContext = {
                version: 1,
                promptVersion: 'work-context-v1',
                workRevision: work.revision + 1,
                inputRevision: run.inputRevision,
                settingsRevision,
                summary: validOutput.summary,
                documents: input.sources.map(({ id, digest }) => ({
                  id,
                  digest,
                })),
                missingFields: acceptedFacts.missingFields,
                // Снимок сессии фиксирует расхождения на момент сохранения этой редакции.
                conflictFields: acceptedFacts.discrepancyFields,
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
                    errorCode: contextChanged
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
          }, signal);
          return true;
        },
        input.signal,
      );
      if (accepted) {
        if (reconciliationError) {
          logWorkFailure(deps.logger, run, reconciliationCause, {
            code: reconciliationError,
            message: 'Не удалось сверить исходники и сведения работы.',
            operation: 'work.analysis.reconcile',
            state: input.completed === 0 ? 'failed' : 'partial',
          });
        }
        return;
      }
    }
  };
}
