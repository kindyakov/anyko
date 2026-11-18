import type { WorkFacts } from '../../modules/agents';
import type { DocumentAnalysis } from '../../modules/documents';

const compact = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

export function locateEvidence(
  candidates: WorkFacts['candidates'],
  sources: (Pick<DocumentAnalysis, 'text' | 'pdfOcr'> & { id: string })[],
): WorkFacts['candidates'] {
  const documents = new Map(
    sources.map(({ id, text, pdfOcr }) => [
      id,
      {
        text: compact(text),
        pages:
          pdfOcr?.pages.map(({ page, lines }) => ({
            page,
            text: compact(lines.map((line) => line.text).join(' ')),
          })) ?? [],
      },
    ]),
  );
  return candidates.map((candidate) => ({
    ...candidate,
    evidence: candidate.evidence.map(({ documentId, imagePath, quote }) => {
      const evidence = { documentId, imagePath, quote };
      const source = documents.get(documentId);
      if (imagePath !== null || !source?.pages.length) return evidence;
      const needle = compact(quote);
      if (needle.length < 4) return evidence;
      const start = source.text.indexOf(needle);
      if (start < 0 || source.text.indexOf(needle, start + 1) !== -1)
        return evidence;
      const pages = source.pages.filter((entry) => entry.text.includes(needle));
      return pages.length === 1 && pages[0]
        ? { ...evidence, page: pages[0].page }
        : evidence;
    }),
  }));
}
