import { WorkError, type WorkStore } from '..';
import { brandWorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Создание работы: право, известный пакет, строка и событие в одной транзакции (вызывает сценарий).
export const createWork =
  (deps: {
    store: WorkStore;
    newId: () => string;
    knownPackage: (version: string) => boolean;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { title: string; packageVersion: string },
  ) => {
    scope.require('works.create');
    if (!deps.knownPackage(input.packageVersion))
      throw new WorkError('INVALID_WORK_INPUT');
    const id = brandWorkId(deps.newId());
    await deps.store.create({
      id,
      workspaceId: scope.workspaceId,
      title: input.title,
      packageVersion: input.packageVersion,
      actorId: scope.userId,
    });
    await deps.store.event(scope.workspaceId, id, 'work.created');
    return id;
  };
