import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';

import type {
  DocumentDeps,
  DocumentListInput,
  DocumentPosition,
} from './ports';

function readPosition(cursor: string): DocumentPosition {
  const delimiter = cursor.indexOf('~');
  if (delimiter < 0) throw new DocumentError('INVALID_DOCUMENT');
  const time = cursor.slice(0, delimiter);
  const id = cursor.slice(delimiter + 1);
  const createdAt = new Date(time);
  if (
    !id ||
    Number.isNaN(createdAt.valueOf()) ||
    createdAt.toISOString() !== time
  )
    throw new DocumentError('INVALID_DOCUMENT');
  return { createdAt, id };
}

// Маркер хранит ключ сортировки, поэтому продолжение доступно после удаления опорного документа.
export const listDocuments =
  (deps: Pick<DocumentDeps, 'store'>) =>
  async (
    scope: WorkspaceScope,
    { after, limit, ...filters }: DocumentListInput,
  ) => {
    scope.require('recognitions.use');
    const rows = await deps.store.list(scope.workspaceId, {
      ...filters,
      limit: limit + 1,
      ...(after === undefined ? {} : { after: readPosition(after) }),
    });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last ? last.createdAt + '~' + last.id : null,
    };
  };
