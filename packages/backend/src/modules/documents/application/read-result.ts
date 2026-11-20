import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { DocumentResultView, InternalResultRef } from '../index';

import type { DocumentDeps } from './ports';
import { readArtifact } from './read-artifact';

// Результат распознавания: текст и порядок изображений. Адрес изображения строит транспорт.
export const readResult = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const artifact = readArtifact(deps);
  const internal = async (
    input: InternalResultRef,
  ): Promise<DocumentResultView> => {
    const { result, revision } = await artifact(input);
    return {
      markdown: result.markdown,
      processorVersion: result.processorVersion,
      revision,
      ...(result.pdfOcr && { pdfOcr: result.pdfOcr }),
      // Адрес изображения строит транспорт: версия пути у v1 и временного слоя разная.
      images: result.images.map((image, index) => ({
        path: image.path,
        index,
        checksum: image.checksum,
      })),
    };
  };
  return {
    internal,
    recognition: async (
      scope: WorkspaceScope,
      documentId: DocumentId,
      revision?: number,
    ) => {
      scope.require('recognitions.use');
      return internal({
        workspaceId: scope.workspaceId,
        documentId,
        ...(revision === undefined ? {} : { revision }),
      });
    },
  };
};
