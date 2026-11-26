import type {
  DocumentAnalysis,
  DocumentAnalysisSource,
  InternalResultRef,
} from '../index';

import { checksum } from './checksum';
import type { DocumentDeps } from './ports';
import { readArtifact } from './read-artifact';
import { cloudImageOcrVersion } from './result-schema';

type SavedResult = Awaited<
  ReturnType<ReturnType<typeof readArtifact>>
>['result'];
const sourceDigest = (result: SavedResult) =>
  checksum(new TextEncoder().encode(JSON.stringify(result)));
const analysisImages = (result: SavedResult) =>
  result.processorVersion === cloudImageOcrVersion ? [] : result.images;

export const readAnalysisSource = (
  deps: Pick<DocumentDeps, 'store' | 'storage'>,
) => {
  const artifact = readArtifact(deps);
  return async (input: InternalResultRef): Promise<DocumentAnalysisSource> => {
    const { result } = await artifact(input);
    return {
      text: result.markdown,
      imagePaths: analysisImages(result).map(({ path }) => path),
      sourceDigest: await sourceDigest(result),
    };
  };
};

// Вход анализа работы: текст и изображения распознанного документа с проверкой контрольных сумм.
// Вызывает только процесс исполнения (worker), право проверено при постановке запуска.
export const readAnalysis = (deps: Pick<DocumentDeps, 'store' | 'storage'>) => {
  const artifact = readArtifact(deps);
  return async (input: InternalResultRef): Promise<DocumentAnalysis> => {
    const { result } = await artifact(input);
    const images = [];
    // These frames already contributed to the saved transcription.
    for (const image of analysisImages(result)) {
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
      ...(result.tableImages && { tableImages: result.tableImages }),
      images,
      sourceDigest: await sourceDigest(result),
    };
  };
};
