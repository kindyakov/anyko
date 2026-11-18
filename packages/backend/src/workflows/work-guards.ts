import {
  WorkError,
  type WorkSourceRow,
  type WorkSources,
  type WorksPorts,
  type WorkSummary,
} from '../modules/works';
import type { WorkId } from '../platform/ids';
import type { WorkspaceScope } from '../platform/scope/workspace-scope';

// Общий ключ для пользовательских команд, исполнения запуска и обслуживания работы.
export const workLockKey = (workspaceId: string, workId: string) =>
  `work:${workspaceId}:${workId}`;

// Пишущие сценарии проверяют редакцию на строке работы внутри собственной транзакции.
export async function guardWorkRevision(
  works: Pick<WorksPorts['internal'], 'lockRevision' | 'touch'>,
  { workspaceId, workId }: { workspaceId: string; workId: string },
  revision: number,
  signal: AbortSignal,
  advance?: 'draft' | 'confirmed',
): Promise<void> {
  signal.throwIfAborted();
  if (advance)
    await works.touch(workspaceId, workId, {
      expectedRevision: revision,
      confirmed: advance === 'confirmed',
    });
  else await works.lockRevision(workspaceId, workId, revision);
  signal.throwIfAborted();
}

export async function requireWork(
  works: WorksPorts['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
): Promise<WorkSummary> {
  const work = await works.find(scope, workId);
  if (!work) throw new WorkError('NOT_FOUND');
  return work;
}

export async function requireCleanSources(
  works: WorksPorts['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
): Promise<WorkSourceRow[]> {
  return cleanWorkSources(await works.sources(scope, workId));
}

export function cleanWorkSources(state: WorkSources): WorkSourceRow[] {
  if (state.cleanupPending) throw new WorkError('CLEANUP_PENDING');
  return state.documents;
}
