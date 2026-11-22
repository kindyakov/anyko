import type { ChecklistSuggestion } from '../../modules/agents';
import type { DocumentAnalysis } from '../../modules/documents';
import type { ChecklistLink, ChecklistRequirement } from '../../modules/works';
import { literalSourceQuote } from '../../platform/source-quote';

export interface ChecklistAnalysisSource {
  id: string;
  ocrRevision: number;
  text: string;
  pdfOcr?: DocumentAnalysis['pdfOcr'];
  visuals: { path: string; description: string }[];
}

export function validateChecklistSuggestions(
  requirements: readonly ChecklistRequirement[],
  sources: readonly ChecklistAnalysisSource[],
  suggestions: readonly ChecklistSuggestion[],
) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const keys = new Set(requirements.map(({ key }) => key));
  const links = new Map<string, ChecklistLink>();
  const rejectedDocumentIds = new Set<string>();
  for (const {
    documentId,
    requirementKey,
    imagePath,
    quote,
    decision,
  } of suggestions) {
    const source = byId.get(documentId);
    if (!source || !keys.has(requirementKey) || !quote.trim()) {
      rejectedDocumentIds.add(documentId);
      continue;
    }
    const citation =
      imagePath === null
        ? source.text
        : source.visuals.find(({ path }) => path === imagePath)?.description;
    const literal = literalSourceQuote(citation, quote);
    if (literal === undefined) {
      rejectedDocumentIds.add(documentId);
      continue;
    }
    const pages =
      imagePath === null
        ? source.pdfOcr?.pages.filter(
            ({ lines }) =>
              literalSourceQuote(
                lines.map(({ text }) => text).join(' '),
                quote,
              ) !== undefined,
          )
        : undefined;
    const key = `${documentId}:${requirementKey}`;
    if (links.get(key)?.decision === 'found') continue;
    links.set(key, {
      requirementKey,
      documentId,
      ocrRevision: source.ocrRevision,
      decision,
      quote: literal,
      page: pages?.length === 1 ? (pages[0]?.page ?? null) : null,
    });
  }
  return { links: [...links.values()], rejectedDocumentIds };
}
