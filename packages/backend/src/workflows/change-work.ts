import type { ResourceLocks } from '../modules/documents';
import type { ProcessingQueries } from '../modules/processing';
import {
  WorkError,
  type WorkEventKind,
  type WorksModule,
  type WorkSourceRow,
  type WorkSummary,
} from '../modules/works';
import type { WorkId } from '../platform/ids';
import type { WorkspaceScope } from '../platform/scope/workspace-scope';
import type { Tx, UnitOfWork } from '../platform/transactions';

import { requireCleanSources, requireWork, workLockKey } from './work-guards';

interface ChangeWorkDeps {
  locks: ResourceLocks;
  works: WorksModule;
  processing: { queries: Pick<ProcessingQueries, 'isActive'> };
  uow: UnitOfWork;
}

type ChangeContext = {
  work: WorkSummary;
  documents: WorkSourceRow[];
};

export async function changeWork(
  deps: ChangeWorkDeps,
  scope: WorkspaceScope,
  input: {
    workId: WorkId;
    expectedRevision?: number;
    requireIdle: boolean;
    advance?: 'draft' | 'confirmed';
    event: WorkEventKind;
  },
  prepare: (
    context: ChangeContext,
  ) => ((tx: Tx) => Promise<void>) | Promise<(tx: Tx) => Promise<void>>,
): Promise<void> {
  const { workspaceId } = scope;
  const { workId, expectedRevision, advance, event } = input;
  await deps.locks.run(workLockKey(workspaceId, workId), async () => {
    const work = await requireWork(deps.works.queries, scope, workId);
    const documents = await requireCleanSources(
      deps.works.queries,
      scope,
      workId,
    );
    if (expectedRevision !== undefined && work.revision !== expectedRevision)
      throw new WorkError('REVISION_CONFLICT');
    // У анализа входные данные и подключение проверяются до занятости работы.
    const apply = await prepare({ work, documents });
    if (
      input.requireIdle &&
      (await deps.processing.queries.isActive(scope, workId))
    )
      throw new WorkError('WORK_BUSY');
    await deps.uow.run(async (tx) => {
      await apply(tx);
      const works = deps.works.in(tx).internal;
      if (advance)
        await works.touch(
          workspaceId,
          workId,
          advance === 'confirmed' ? { confirmed: true } : {},
        );
      await works.event(workspaceId, workId, event);
    });
  });
}
