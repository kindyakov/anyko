import { LlmError } from '@anyko/llm';

import type { WorkspaceActorScope } from '../../modules/access';
import type { WorkAttempt } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import { WorkError } from '../../modules/works';
import { isAppError } from '../../platform/errors';
import { callModel } from '../work-analysis/model-call';
import type { WorkDependencies } from '../work-dependencies';
import { logWorkFailure } from '../work-execution/failure';
import { createRunState } from '../work-execution/run-state';
import { workLockKey } from '../work-guards';

import { prepareChatWriter, requireChatActor } from './write-actions';

export function createWorkChatRun(
  deps: WorkDependencies,
  actorScope: WorkspaceActorScope,
) {
  return async function runChat(attempt: WorkAttempt, signal: AbortSignal) {
    const { run } = attempt;
    const { workspaceId, workId, id: runId, settingsRevision } = run;
    const ref = { workspaceId, workId, runId };
    const scope = { workspaceId, workId };
    const { current } = createRunState(deps, attempt);
    const readConnection = () =>
      deps.connections.internal.connection(workspaceId, settingsRevision);
    const assertRunCurrent = async () => {
      signal.throwIfAborted();
      const work = await current();
      await readConnection();
      return work.revision;
    };
    const work = await current();
    const config = await readConnection();
    const session = await deps.agents.internal.get(workspaceId, workId);
    const chat = await deps.agents.internal.chat.get(ref);
    if (!session || !chat || session.id !== chat.sessionId)
      throw new WorkError('NOT_FOUND');
    const requireActor = requireChatActor(actorScope, workspaceId, chat.userId);
    await requireActor();
    const assertCurrent = async () => {
      await assertRunCurrent();
      await requireActor();
    };
    const [facts, messages, links] = await Promise.all([
      deps.facts.queries.forAnalysis(scope),
      deps.agents.internal.chat.context({ ...scope, sessionId: session.id }),
      deps.works.internal.documents(workspaceId, workId),
    ]);
    const documents = links.flatMap(({ id, filename, ocrRevision, deleted }) =>
      !deleted && run.documentIds.includes(id) && ocrRevision !== null
        ? [{ id, filename, revision: ocrRevision }]
        : [],
    );
    const loadSource = async (documentId: string) => {
      const document = documents.find(({ id }) => id === documentId);
      if (!document) throw new Error('SOURCE_NOT_ALLOWED');
      const source = await deps.documents.internal.queries.analysisSource({
        workspaceId,
        documentId,
        revision: document.revision,
      });
      const visuals = source.imagePaths.length
        ? (
            await deps.processing.internal.sourceVisuals(
              workspaceId,
              workId,
              documentId,
              source.sourceDigest,
            )
          ).filter(({ path }) => source.imagePaths.includes(path))
        : [];
      return { text: source.text, visuals };
    };
    const loaded = new Map<string, ReturnType<typeof loadSource>>();
    const sourceFor = (documentId: string) => {
      let source = loaded.get(documentId);
      if (!source) {
        source = loadSource(documentId);
        loaded.set(documentId, source);
      }
      return source;
    };
    const history = deps.agents.internal.history.record({
      ...ref,
      sessionId: session.id,
    });
    const interaction = { interactionId: deps.newId(), stage: 'chat' as const };
    const observe = history.observe({
      ...interaction,
      provider: config.connection.id,
      model: config.extractionModel,
    });
    const fields = requirePackage(work.packageVersion).fields;
    const requirements = await deps.templateRequirements(work.packageVersion);
    const checklistSources = links.filter(({ deleted }) => !deleted);
    const writer = await prepareChatWriter(deps, {
      attempt,
      requireActor,
      initialRevision: work.revision,
      sessionId: session.id,
      interactionId: interaction.interactionId,
      fields,
      checklistSources: new Map(
        checklistSources.map(({ id, ocrRevision }) => [id, ocrRevision]),
      ),
      assertCurrent: assertRunCurrent,
    });
    const result = await callModel({
      logger: deps.logger,
      callId: interaction.interactionId,
      runId,
      correlationId: run.correlationId,
      stage: 'chat',
      provider: config.connection.id,
      model: config.extractionModel,
      execute: () =>
        deps.agents.model.chat({
          trace: {
            correlationId: run.correlationId,
            jobId: runId,
            stage: 'chat',
          },
          observe: async (request) => {
            await assertCurrent();
            return observe(request);
          },
          traceTool: (event) => history.tool({ ...interaction, ...event }),
          modelId: config.extractionModel,
          connection: config.connection,
          fields,
          facts,
          currentFacts: () => deps.facts.queries.forAnalysis(scope),
          previousContext: session.context,
          documents: documents.map(({ id, filename }) => ({ id, filename })),
          messages,
          userText: chat.userText,
          signal,
          appliedFields: writer.appliedFields,
          writeField: writer.writeField,
          ...(requirements.length > 0 && {
            checklist: {
              requirements: requirements.map(({ key, label }) => ({
                key,
                label,
              })),
              sources: checklistSources.map(({ id, filename }) => ({
                id,
                filename,
              })),
              applied: writer.appliedChecklist,
              write: writer.writeChecklist,
            },
          }),
          assertCurrent,
          listSourceImages: async (documentId) =>
            (await sourceFor(documentId)).visuals.map(({ path }) => path),
          readSource: async (documentId, imagePath) => {
            const { text, visuals } = await sourceFor(documentId);
            if (imagePath === null) return text;
            const visual = visuals.find(({ path }) => path === imagePath);
            if (!visual) throw new Error('SOURCE_NOT_ALLOWED');
            return visual.description;
          },
        }),
    }).then(
      ({ answer }) => ({ answer }),
      (error: unknown) => {
        if (signal.aborted) throw error;
        const code =
          error instanceof LlmError || isAppError(error)
            ? error.code
            : 'WORK_PROCESSING_FAILED';
        const failure = writer.failure({ errorCode: code, cause: error });
        if (!failure) throw error;
        return { failure };
      },
    );
    const failure = 'failure' in result ? result.failure : writer.failure();
    await deps.locks.run(
      workLockKey(workspaceId, workId),
      async (lockSignal) => {
        signal.throwIfAborted();
        if (failure) await current();
        else await assertCurrent();
        await attempt.write(
          async (tx, write) => {
            if (!failure && 'answer' in result)
              await deps.agents.in(tx).internal.chat.answer(ref, result.answer);
            await write.finish(failure?.outcome ?? { status: 'succeeded' });
            await deps.works
              .in(tx)
              .internal.event(
                workspaceId,
                workId,
                failure ? 'processing.failed' : 'processing.changed',
              );
          },
          AbortSignal.any([signal, lockSignal]),
        );
      },
      signal,
    );
    if (failure) {
      logWorkFailure(deps.logger, run, failure.cause, {
        code: failure.outcome.errorCode,
        message: 'Не удалось завершить изменение работы через чат.',
        operation: 'work.chat',
        state: failure.outcome.status,
      });
    }
  };
}
