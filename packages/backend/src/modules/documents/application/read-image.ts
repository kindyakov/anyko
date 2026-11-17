import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';
import type { DocumentImage } from '../index';

import { checksum } from './checksum';
import type { DocumentDeps } from './ports';

// Изображение страницы результата: размер и контрольная сумма сверяются перед отдачей.
export const readImage = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
    index: number;
  }): Promise<DocumentImage> => {
    const image = await deps.store.image(
      input.workspaceId,
      input.documentId,
      input.index,
    );
    if (!image) throw new DocumentError('NOT_FOUND');
    const bytes = await deps.storage.get(image.key);
    if (
      bytes.length !== image.size ||
      (await checksum(bytes)) !== image.checksum
    )
      throw new Error('INVALID_IMAGE_ARTIFACT');
    return { bytes, contentType: image.contentType };
  };
  return {
    internal,
    recognition: async (
      scope: WorkspaceScope,
      documentId: DocumentId,
      index: number,
    ) => {
      scope.require('recognitions.use');
      return internal({ workspaceId: scope.workspaceId, documentId, index });
    },
  };
};
