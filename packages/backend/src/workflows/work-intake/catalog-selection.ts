import { WorkError } from '../../modules/works';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';

import type { WorkIntakeDeps } from './deps';

export const workSourceLimit = 20;

export function requireCatalogSelection(scope: WorkspaceScope) {
  scope.require('documents.upload');
  scope.require('recognitions.use');
}

export async function resolveCatalogSelection(
  deps: Pick<WorkIntakeDeps, 'lockDocumentRevisions'>,
  tx: Tx,
  workspaceId: string,
  documentIds: string[],
  alreadyAttached: ReadonlySet<string>,
) {
  const requested = [
    ...new Set(documentIds.filter((id) => !alreadyAttached.has(id))),
  ];
  if (alreadyAttached.size + requested.length > workSourceLimit)
    throw new WorkError('INVALID_WORK_INPUT');
  const selected = await deps.lockDocumentRevisions(tx, workspaceId, requested);
  const ready = new Set(
    selected.filter(({ revision }) => revision !== null).map(({ id }) => id),
  );
  const fields = documentIds.flatMap((id, index) =>
    alreadyAttached.has(id) || ready.has(id)
      ? []
      : [{ path: ['documentIds', index], code: 'invalid_value' as const }],
  );
  if (fields.length) throw new WorkError('NOT_READY', { fields });
  return selected;
}
