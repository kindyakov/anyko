import { WorkError } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import type { WorkDependencies } from '../work-dependencies';
import { requireCleanSources, requireWork, workLockKey } from '../work-guards';

export function createWorkChat(
  deps: Pick<
    WorkDependencies,
    | 'agents'
    | 'chatProgress'
    | 'connections'
    | 'locks'
    | 'processing'
    | 'uow'
    | 'works'
  >,
) {
  const feed = deps.chatProgress;
  return {
    progressActive:
      deps.chatProgress &&
      ((scope: WorkspaceScope, workId: WorkId) => {
        scope.require('works.read');
        return deps.processing.queries.isActive(scope, workId, 'chat');
      }),
    progress:
      feed &&
      ((
        scope: WorkspaceScope,
        workId: WorkId,
        after: string,
        signal: AbortSignal,
        receive: Parameters<typeof feed.subscribe>[3],
      ) => {
        scope.require('works.read');
        return feed.subscribe(
          { workspaceId: scope.workspaceId, workId },
          after,
          signal,
          receive,
        );
      }),
    async list(
      scope: WorkspaceScope,
      input: { workId: WorkId; page: number; pageSize: number },
    ) {
      scope.require('works.read');
      const { workId, page, pageSize } = input;
      return deps.locks.run(
        workLockKey(scope.workspaceId, workId),
        async () => {
          await requireWork(deps.works.queries, scope, workId);
          await requireCleanSources(deps.works.queries, scope, workId);
          const canSend =
            scope.has(workCommandPolicy.chat.right) &&
            !(await deps.processing.queries.isActive(scope, workId));
          const timeline = await deps.agents.internal.chat.timeline(
            { workspaceId: scope.workspaceId, workId },
            page,
            pageSize,
          );
          return { ...timeline, page, pageSize, canSend };
        },
      );
    },
    async send(
      scope: WorkspaceScope,
      input: {
        workId: WorkId;
        userText: string;
        correlationId: string;
      },
    ) {
      scope.require(workCommandPolicy.chat.right);
      const { workspaceId } = scope;
      const { workId, userText, correlationId } = input;
      let runId: string | undefined;
      await changeWork(
        deps,
        scope,
        { workId, command: 'chat', event: 'processing.queued' },
        async ({ work, documents }) => {
          const settings = await deps.connections.internal.configuration(
            workspaceId,
            true,
          );
          if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
          return async (tx) => {
            const agents = deps.agents.in(tx).internal;
            const session = await agents.ensure(workspaceId, workId);
            runId = await deps.processing.in(tx).commands.start(scope, {
              workId,
              kind: 'chat',
              inputRevision: work.inputRevision,
              documentIds: documents
                .filter((doc) => !doc.deleted && doc.ocrRevision !== null)
                .map(({ id }) => id),
              settingsRevision: settings.revision,
              generationId: null,
              correlationId,
              modelSnapshot: {
                vision: settings.visionModel,
                extraction: settings.extractionModel,
              },
            });
            await agents.chat.create({
              workspaceId,
              workId,
              sessionId: session.id,
              runId,
              userText,
            });
          };
        },
      );
      if (!runId) throw new Error('CHAT_RUN_NOT_CREATED');
      return { runId, status: 'queued' as const };
    },
  };
}

export type WorkChat = ReturnType<typeof createWorkChat>;
