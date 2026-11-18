import {
  WorkError,
  type WorkSourceRow,
  type WorksPorts,
  type WorkSummary,
} from '../modules/works';
import type { WorkId } from '../platform/ids';
import type { WorkspaceScope } from '../platform/scope/workspace-scope';

// Общий ключ для пользовательских команд, исполнения запуска и обслуживания работы.
export const workLockKey = (workspaceId: string, workId: string) =>
  `work:${workspaceId}:${workId}`;

export async function requireWork(
  works: WorksPorts['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
): Promise<WorkSummary> {
  const work = await works.find(scope, workId);
  if (!work) throw new WorkError('NOT_FOUND');
  return work;
}

// Исходники готовы к изменению: нет удалённых и нет незавершённых записей.
export async function requireCleanSources(
  works: WorksPorts['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
): Promise<WorkSourceRow[]> {
  const state = await works.sources(scope, workId);
  if (state.cleanupPending) throw new WorkError('CLEANUP_PENDING');
  return state.documents;
}
