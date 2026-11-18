import type { DocumentResultView } from '@anyko/backend/documents';

export function presentDocumentResult(
  result: DocumentResultView,
  imageUrl: (index: string) => string,
) {
  return {
    markdown: result.markdown,
    processorVersion: result.processorVersion,
    images: result.images.map(({ path, index }) => ({
      path,
      url: imageUrl(String(index)),
    })),
  };
}
