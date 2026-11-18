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

import {
  requireIdleWork,
  workCommandPolicy,
  workCommandSources,
} from './work-command-guards';
import { guardWorkRevision, requireWork, workLockKey } from './work-guards';

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
    command: 'analyze' | 'generate' | 'confirm' | 'edit';
    advance?: 'draft' | 'confirmed';
    event: WorkEventKind;
  },
  prepare: (
    context: ChangeContext,
  ) => ((tx: Tx) => Promise<void>) | Promise<(tx: Tx) => Promise<void>>,
): Promise<void> {
  const { workspaceId } = scope;
  const { workId, expectedRevision, advance, event } = input;
  await deps.locks.run(workLockKey(workspaceId, workId), async (signal) => {
    try {
      const work = await requireWork(deps.works.queries, scope, workId);
      const documents = workCommandSources(
        input.command,
        await deps.works.queries.sources(scope, workId),
      );
      if (expectedRevision !== undefined && work.revision !== expectedRevision)
        throw new WorkError('REVISION_CONFLICT');
      // У анализа входные данные и подключение проверяются до занятости работы.
      signal.throwIfAborted();
      const apply = await prepare({ work, documents });
      signal.throwIfAborted();
      if (workCommandPolicy[input.command].idle)
        requireIdleWork(await deps.processing.queries.isActive(scope, workId));
      await deps.uow.run(async (tx) => {
        const works = deps.works.in(tx).internal;
        await guardWorkRevision(
          works,
          { workspaceId, workId },
          work.revision,
          signal,
          advance,
        );
        await apply(tx);
        signal.throwIfAborted();
        await works.event(workspaceId, workId, event);
      }, signal);
    } catch (error) {
      if (signal.aborted && error === signal.reason)
        throw new WorkError('REVISION_CONFLICT');
      throw error;
    }
  });
}
