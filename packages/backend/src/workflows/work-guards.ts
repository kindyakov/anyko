import type { ProcessingModule } from '../modules/processing';
import {
  WorkError,
  type WorkSourceRow,
  type WorksPorts,
  type WorkSummary,
} from '../modules/works';
import type { WorkId } from '../platform/ids';
import type { WorkspaceScope } from '../platform/scope/workspace-scope';

// Общие проверки сценариев работы. Ключ блокировки совпадает с ключом исполнения (workflows/work-execution):
// изменения работы и её запуски не идут параллельно.
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

// Работа, которую можно менять по ожидаемой ревизии: есть, исходники готовы, ревизия совпадает.
export async function requireRevision(
  works: WorksPorts['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
  revision: number,
): Promise<{ work: WorkSummary; documents: WorkSourceRow[] }> {
  const work = await requireWork(works, scope, workId);
  const documents = await requireCleanSources(works, scope, workId);
  if (work.revision !== revision) throw new WorkError('REVISION_CONFLICT');
  return { work, documents };
}

// Нет запуска в очереди или в исполнении: иначе изменение конкурирует с обработкой.
export async function requireIdle(
  processing: ProcessingModule['queries'],
  scope: WorkspaceScope,
  workId: WorkId,
): Promise<void> {
  if (await processing.isActive(scope, workId))
    throw new WorkError('WORK_BUSY');
}
