import type { Clock } from '../../platform/clock';
import type { WorkDependencies } from '../work-dependencies';
import { workLockKey } from '../work-guards';

export {
  createWorkDeletionApi,
  type WorkDeletionApi,
} from './request-work-deletion';

type WorkRef = { workspaceId: string; workId: string };

export function createWorkCleanup(
  deps: WorkDependencies,
  options: {
    clock: Clock;
    sourcesDeleted(workspaceId: string, ids: string[]): Promise<boolean>;
  },
) {
  async function eraseDerived(
    { workspaceId, workId }: WorkRef,
    signal: AbortSignal,
    deletingWork: boolean,
  ) {
    await deps.io.assertIdle(workspaceId, workId);
    await deps.chatProgress?.erase({ workspaceId, workId }).catch(() => {});
    for (const key of await deps.generation.internal.keys(
      workspaceId,
      workId,
    )) {
      signal.throwIfAborted();
      await deps.storage.delete(key, signal);
      if (await deps.storage.exists(key))
        throw new Error('WORK_ARTIFACT_DELETE_FAILED');
    }
    for (const thread of await deps.processing.internal.threads(
      workspaceId,
      workId,
    )) {
      signal.throwIfAborted();
      await deps.agents.model.eraseThread(thread);
    }
    signal.throwIfAborted();
    await deps.uow.run(async (tx) => {
      await deps.agents.in(tx).internal.erase(workspaceId, workId);
      await deps.facts.in(tx).internal.erase(workspaceId, workId);
      await deps.generation.in(tx).internal.erase(workspaceId, workId);
      await deps.processing.in(tx).internal.erase(workspaceId, workId);
      await deps.processing.in(tx).internal.eraseThreads(workspaceId, workId);
      const works = deps.works.in(tx).internal;
      await works.detachDeleted(workspaceId, workId);
      if (deletingWork) {
        await works.prepareDeletion(workspaceId, workId, options.clock.now());
      } else {
        await works.touch(workspaceId, workId, { inputChanged: true });
        await works.event(workspaceId, workId, 'sources.erased');
      }
    });
  }

  return async () => {
    for (const {
      workspaceId,
      id: workId,
    } of await deps.works.internal.pendingDeletions()) {
      try {
        await deps.locks.run(
          workLockKey(workspaceId, workId),
          async (signal) => {
            const deletion = await deps.works.internal.deletion(
              workspaceId,
              workId,
            );
            if (!deletion || deletion.completedAt) return;
            if (!deletion.preparedAt)
              await eraseDerived({ workspaceId, workId }, signal, true);
            if (
              !(await options.sourcesDeleted(workspaceId, deletion.documentIds))
            )
              return;
            signal.throwIfAborted();
            await deps.uow.run((tx) =>
              deps.works
                .in(tx)
                .internal.finishDeletion(
                  workspaceId,
                  workId,
                  options.clock.now(),
                ),
            );
          },
        );
      } catch {
        await deps.works.internal.failDeletion(
          workspaceId,
          workId,
          options.clock.now(),
        );
        deps.logger.warn({ event: 'work_deletion_retry', jobId: workId });
      }
    }
    for (const item of await deps.works.internal.dirty()) {
      try {
        await deps.locks.run(
          workLockKey(item.workspaceId, item.workId),
          async (signal) => {
            // Deletion may have started after the dirty list was read.
            if (!(await deps.works.internal.get(item.workspaceId, item.workId)))
              return;
            await eraseDerived(item, signal, false);
          },
        );
      } catch {
        deps.logger.warn({ event: 'work_cleanup_pending' });
      }
    }
  };
}
