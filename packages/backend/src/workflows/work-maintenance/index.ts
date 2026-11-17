import type { WorkDependencies } from '../work-dependencies';

// Фоновое обслуживание работ worker: удаление производных данных работы после удаления исходников.
// Владелец процесса — работа: очистка не относится ни к исполнению запуска, ни к удалению документа.
// Физический барьер документа снимается только после стирания производных данных.
export function createWorkCleanup(deps: WorkDependencies) {
  return async () => {
    for (const item of await deps.works.internal.dirty()) {
      try {
        await deps.locks.run(
          `work:${item.workspaceId}:${item.workId}`,
          async () => {
            await deps.workIo.assertIdle(item.workspaceId, item.workId);
            for (const doc of await deps.works.internal.documents(
              item.workspaceId,
              item.workId,
            ))
              await deps.assertNoDocumentWriters(
                item.workspaceId,
                doc.id,
                doc.requestKey,
              );
            for (const key of await deps.generation.internal.keys(
              item.workspaceId,
              item.workId,
            )) {
              await deps.storage.delete(key);
              if (await deps.storage.exists(key))
                throw new Error('WORK_ARTIFACT_DELETE_FAILED');
            }
            for (const thread of await deps.processing.internal.threads(
              item.workspaceId,
              item.workId,
            ))
              await deps.agents.model.eraseThread(thread);
            await deps.uow.run(async (tx) => {
              await deps.agents
                .in(tx)
                .internal.erase(item.workspaceId, item.workId);
              await deps.facts
                .in(tx)
                .internal.erase(item.workspaceId, item.workId);
              await deps.generation
                .in(tx)
                .internal.erase(item.workspaceId, item.workId);
              await deps.processing
                .in(tx)
                .internal.erase(item.workspaceId, item.workId);
              await deps.processing
                .in(tx)
                .internal.eraseThreads(item.workspaceId, item.workId);
              const works = deps.works.in(tx).internal;
              await works.detachDeleted(item.workspaceId, item.workId);
              await works.touch(item.workspaceId, item.workId, {
                inputChanged: true,
              });
              await works.event(
                item.workspaceId,
                item.workId,
                'sources.erased',
              );
            });
          },
        );
      } catch {
        deps.logger.warn({ event: 'work_cleanup_pending' });
      }
    }
  };
}
