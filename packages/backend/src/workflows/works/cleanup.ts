import type { WorkDependencies } from './ports';

/** Erase derivatives before releasing the document's physical deletion barrier. */
export function createWorkCleanup(deps: WorkDependencies) {
  return async () => {
    for (const item of await deps.works.dirty()) {
      try {
        await deps.locks.run(
          `work:${item.workspaceId}:${item.workId}`,
          async () => {
            await deps.workIo.assertIdle(item.workspaceId, item.workId);
            for (const doc of await deps.works.documents(
              item.workspaceId,
              item.workId,
            ))
              await deps.assertNoDocumentWriters(
                item.workspaceId,
                doc.id,
                doc.requestKey,
              );
            for (const key of await deps.generation.keys(
              item.workspaceId,
              item.workId,
            )) {
              await deps.storage.delete(key);
              if (await deps.storage.exists(key))
                throw new Error('WORK_ARTIFACT_DELETE_FAILED');
            }
            for (const thread of await deps.processing.threads(
              item.workspaceId,
              item.workId,
            ))
              await deps.agents.eraseThread(thread);
            await deps.transaction(
              async ({ works, facts, processing, generation }) => {
                await facts.erase(item.workspaceId, item.workId);
                await generation.erase(item.workspaceId, item.workId);
                await processing.erase(item.workspaceId, item.workId);
                await processing.eraseThreads(item.workspaceId, item.workId);
                await works.detachDeleted(item.workspaceId, item.workId);
                await works.touch(item.workspaceId, item.workId, {
                  inputChanged: true,
                });
                await works.event(
                  item.workspaceId,
                  item.workId,
                  'sources.erased',
                );
              },
            );
          },
        );
      } catch {
        deps.logger.warn({ event: 'work_cleanup_pending' });
      }
    }
  };
}
