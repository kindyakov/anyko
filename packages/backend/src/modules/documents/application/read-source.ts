import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';
import type { DocumentSourceFile } from '../index';

import { checksum } from './checksum';
import type { DocumentDeps } from './ports';
import { sourceContentTypes, sourceFormatFromKey } from './source-format';

// Исходный файл документа: размер и контрольная сумма сверяются перед отдачей.
export const readSource = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
  }): Promise<DocumentSourceFile> => {
    const row = await deps.store.source(input.workspaceId, input.documentId);
    if (!row) throw new DocumentError('NOT_FOUND');
    const bytes = await deps.storage.get(row.key);
    if (bytes.length !== row.size || (await checksum(bytes)) !== row.checksum)
      throw new Error('INVALID_SOURCE_ARTIFACT');
    const format = sourceFormatFromKey(row.filename);
    if (!format) throw new DocumentError('UNSUPPORTED_DOCUMENT_FORMAT');
    return {
      bytes,
      filename: row.filename,
      contentType: sourceContentTypes[format],
    };
  };
  return {
    internal,
    recognition: async (scope: WorkspaceScope, documentId: DocumentId) => {
      scope.require('recognitions.use');
      return internal({ workspaceId: scope.workspaceId, documentId });
    },
  };
};
