import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import type { DocumentResultView } from '../index';

import type { DocumentDeps } from './ports';
import { readArtifact } from './read-artifact';

// Результат распознавания: текст и порядок изображений. Адрес изображения строит транспорт.
export const readResult = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const artifact = readArtifact(deps);
  const internal = async (input: {
    workspaceId: string;
    documentId: string;
  }): Promise<DocumentResultView> => {
    const result = await artifact(input);
    return {
      markdown: result.markdown,
      processorVersion: result.processorVersion,
      // Адрес изображения строит транспорт: версия пути у v1 и временного слоя разная.
      images: result.images.map((image, index) => ({
        path: image.path,
        index,
      })),
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
