import type { DocumentAnalysis } from '../index';

import { checksum } from './checksum';
import type { DocumentDeps } from './ports';
import { readArtifact } from './read-artifact';

// Вход анализа работы: текст и изображения распознанного документа с проверкой контрольных сумм.
// Вызывает только процесс исполнения (worker), право проверено при постановке запуска.
export const readAnalysis = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const artifact = readArtifact(deps);
  return async (input: {
    workspaceId: string;
    documentId: string;
  }): Promise<DocumentAnalysis> => {
    const result = await artifact(input);
    const images = [];
    for (const image of result.images) {
      const bytes = await deps.storage.get(image.key);
      if (
        bytes.length !== image.size ||
        (await checksum(bytes)) !== image.checksum
      )
        throw new Error('INVALID_IMAGE_ARTIFACT');
      images.push({
        path: image.path,
        bytes,
        contentType: image.contentType,
      });
    }
    return {
      text: result.markdown,
      images,
      sourceDigest: await checksum(
        new TextEncoder().encode(JSON.stringify(result)),
      ),
    };
  };
};
