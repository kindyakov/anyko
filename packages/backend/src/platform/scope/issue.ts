import { AppError } from '../errors';
import type { UserId, WorkspaceId } from '../ids';

import type { Right } from './rights';
import type { WorkspaceScope } from './workspace-scope';

// Единственное место, где создаётся WorkspaceScope. Импортировать этот файл может только
// modules/access (правило backend-scope-issued-by-access): вызывающий уже проверил участие.
export function issueWorkspaceScope(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  rights: readonly Right[];
}): WorkspaceScope {
  const granted = new Set<Right>(input.rights);
  const rights: readonly Right[] = [...granted];
  const scope = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    rights,
    has: (right: Right) => granted.has(right),
    require(right: Right) {
      if (!granted.has(right)) throw new AppError('FORBIDDEN', 'forbidden');
    },
  };
  // Бренд объявлен только типом: значение создаётся здесь после проверки участия, поэтому
  // утверждение о форме не проверяется дальше.
  return scope as WorkspaceScope;
}
