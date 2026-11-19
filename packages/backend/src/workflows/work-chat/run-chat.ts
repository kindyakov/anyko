import type { WorkAttempt } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import { WorkError } from '../../modules/works';
import { callModel } from '../work-analysis/model-call';
import type { WorkDependencies } from '../work-dependencies';
import { createRunState } from '../work-execution/run-state';
import { workLockKey } from '../work-guards';

export function createWorkChatRun(deps: WorkDependencies) {
  return async function runChat(attempt: WorkAttempt, signal: AbortSignal) {
    const { run } = attempt;
    const { workspaceId, workId, id: runId, settingsRevision } = run;
    const ref = { workspaceId, workId, runId };
    const scope = { workspaceId, workId };
    const { current } = createRunState(deps, attempt);
    const readConnection = () =>
      deps.connections.internal.connection(workspaceId, settingsRevision);
    const assertCurrent = async () => {
      signal.throwIfAborted();
      await current();
      await readConnection();
    };
    const work = await current();
    const config = await readConnection();
    const session = await deps.agents.internal.get(workspaceId, workId);
    const chat = await deps.agents.internal.chat.get(ref);
    if (!session || !chat || session.id !== chat.sessionId)
      throw new WorkError('NOT_FOUND');
    const [facts, messages, links] = await Promise.all([
      deps.facts.queries.forAnalysis(scope),
      deps.agents.internal.chat.context({ ...scope, sessionId: session.id }),
      deps.works.internal.documents(workspaceId, workId),
    ]);
    const documents = links.flatMap(({ id, filename, ocrRevision }) =>
      run.documentIds.includes(id) && ocrRevision !== null
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
    const { answer } = await callModel({
      logger: deps.logger,
      callId: interaction.interactionId,
      runId,
      correlationId: run.correlationId,
      stage: 'chat',
      provider: config.connection.id,
      model: config.extractionModel,
      execute: () =>
        deps.agents.model.chat({
          observe: history.observe({
            ...interaction,
            provider: config.connection.id,
            model: config.extractionModel,
          }),
          traceTool: (event) => history.tool({ ...interaction, ...event }),
          modelId: config.extractionModel,
          connection: config.connection,
          fields: requirePackage(work.packageVersion).fields,
          facts,
          currentFacts: () => deps.facts.queries.forAnalysis(scope),
          previousContext: session.context,
          documents: documents.map(({ id, filename }) => ({ id, filename })),
          messages,
          userText: chat.userText,
          signal,
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
    });
    await deps.locks.run(
      workLockKey(workspaceId, workId),
      async (lockSignal) => {
        await assertCurrent();
        await attempt.write(async (tx, write) => {
          await deps.agents.in(tx).internal.chat.answer(ref, answer);
          await write.finish({ status: 'succeeded' });
          await deps.works
            .in(tx)
            .internal.event(workspaceId, workId, 'processing.changed');
        }, lockSignal);
      },
      signal,
    );
  };
}
