import type { ResourceLocks } from '../modules/documents';
import type { ProcessingQueries } from '../modules/processing';
import {
  WorkError,
  type WorkEventKind,
  type WorksModule,
  type WorkSourceRow,
  type WorksPorts,
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
    command: keyof typeof workCommandPolicy;
    sourceChange?: boolean;
    advance?: 'draft' | 'confirmed';
    event: WorkEventKind;
  },
  prepare: (context: ChangeContext) => PreparedChange | Promise<PreparedChange>,
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
      if (!apply) return;
      if (workCommandPolicy[input.command].idle)
        requireIdleWork(await deps.processing.queries.isActive(scope, workId));
      await deps.uow.run(async (tx) => {
        const works = deps.works.in(tx).internal;
        if (input.sourceChange) {
          const change = await apply(tx, () =>
            guardWorkRevision(
              works,
              { workspaceId, workId },
              work.revision,
              signal,
            ),
          );
          signal.throwIfAborted();
          await finishSourceChange(
            works,
            workspaceId,
            workId,
            work.revision,
            event,
            change ?? undefined,
          );
          return;
        }
        await guardWorkRevision(
          works,
          { workspaceId, workId },
          work.revision,
          signal,
          advance,
        );
        await apply(tx, () => Promise.resolve());
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

type SourceChange = { confirmed: boolean };
type PreparedChange =
  | ((
      tx: Tx,
      lockRevision: () => Promise<void>,
    ) => Promise<void> | Promise<SourceChange>)
  | undefined;

// Source commands can lock source rows before advancing the work revision.
export async function finishSourceChange(
  works: Pick<WorksPorts['internal'], 'lockRevision' | 'touch' | 'event'>,
  workspaceId: string,
  workId: string,
  revision: number,
  event: WorkEventKind,
  change: SourceChange | undefined,
) {
  if (change) {
    await works.touch(workspaceId, workId, {
      expectedRevision: revision,
      inputChanged: true,
      confirmed: change.confirmed,
    });
  } else {
    await works.lockRevision(workspaceId, workId, revision);
  }
  await works.event(workspaceId, workId, event);
}
