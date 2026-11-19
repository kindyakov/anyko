import type { DocumentAnalysis, InternalResultRef } from '../index';

import { checksum } from './checksum';
import type { DocumentDeps } from './ports';
import { readArtifact } from './read-artifact';
import { cloudImageOcrVersion } from './result-schema';

// Вход анализа работы: текст и изображения распознанного документа с проверкой контрольных сумм.
// Вызывает только процесс исполнения (worker), право проверено при постановке запуска.
export const readAnalysis = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const artifact = readArtifact(deps);
  return async (input: InternalResultRef): Promise<DocumentAnalysis> => {
    const { result } = await artifact(input);
    const images = [];
    // These frames already contributed to the saved transcription.
    for (const image of result.processorVersion === cloudImageOcrVersion
      ? []
      : result.images) {
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
      ...(result.pdfOcr && { pdfOcr: result.pdfOcr }),
      images,
      sourceDigest: await checksum(
        new TextEncoder().encode(JSON.stringify(result)),
      ),
    };
  };
};
