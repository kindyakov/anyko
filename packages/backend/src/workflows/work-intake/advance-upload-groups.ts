import { brandWorkId } from '../../platform/ids';
import type { WorkDependencies } from '../work-dependencies';
import { workLockKey } from '../work-guards';

export function advanceUploadGroups(
  deps: Pick<
    WorkDependencies,
    | 'works'
    | 'processing'
    | 'uow'
    | 'locks'
    | 'io'
    | 'connections'
    | 'newId'
    | 'logger'
  >,
) {
  return async () => {
    for (const {
      workspaceId,
      workId,
    } of await deps.works.internal.pendingUploadWorks()) {
      try {
        await deps.locks.run(
          workLockKey(workspaceId, workId),
          async (signal) => {
            const work = await deps.works.internal.get(workspaceId, workId);
            if (!work || !(await deps.io.clean(workspaceId, workId))) return;
            await deps.uow.run(async (tx) => {
              const works = deps.works.in(tx).internal;
              const processing = deps.processing.in(tx).internal;
              await works.lockRevision(workspaceId, workId, work.revision);
              const documents = await works.documents(workspaceId, workId);
              if (documents.some(({ deleted }) => deleted)) return;
              await works.closeOpenUploadGroup(workspaceId, workId);
              const group = await works.readyUploadGroup(workspaceId, workId);
              if (!group) return;
              if (group.documentIds.length) {
                if (await processing.active(workspaceId, workId)) return;
                const settings = await deps.connections
                  .in(tx)
                  .internal.configuration(workspaceId);
                if (!settings) return;
                await processing.startUploadAnalysis(
                  workspaceId,
                  group.actorId,
                  {
                    workId: brandWorkId(workId),
                    inputRevision: work.inputRevision,
                    documentIds: group.documentIds,
                    settingsRevision: settings.revision,
                    correlationId: deps.newId(),
                    modelSnapshot: {
                      vision: settings.visionModel,
                      extraction: settings.extractionModel,
                    },
                  },
                );
                await works.event(workspaceId, workId, 'processing.queued');
              }
              await works.dispatchUploadGroup(workspaceId, workId, group.id);
            }, signal);
          },
        );
      } catch {
        deps.logger.warn({
          event: 'work_upload_analysis_pending',
          jobId: workId,
        });
      }
    }
  };
}
