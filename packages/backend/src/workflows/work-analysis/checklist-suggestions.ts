import type { ChecklistSuggestion } from '../../modules/agents';
import type { DocumentAnalysis } from '../../modules/documents';
import type { ChecklistLink, ChecklistRequirement } from '../../modules/works';

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
): ChecklistLink[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const keys = new Set(requirements.map(({ key }) => key));
  const links = new Map<string, ChecklistLink>();
  for (const {
    documentId,
    requirementKey,
    imagePath,
    quote,
    decision,
  } of suggestions) {
    const source = byId.get(documentId);
    if (!source || !keys.has(requirementKey) || !quote.trim()) continue;
    const citation =
      imagePath === null
        ? source.text
        : source.visuals.find(({ path }) => path === imagePath)?.description;
    if (!citation?.includes(quote)) continue;
    const pages =
      imagePath === null
        ? source.pdfOcr?.pages.filter(({ lines }) =>
            lines
              .map(({ text }) => text)
              .join(' ')
              .includes(quote),
          )
        : undefined;
    const key = `${documentId}:${requirementKey}`;
    if (links.get(key)?.decision === 'found') continue;
    links.set(key, {
      requirementKey,
      documentId,
      ocrRevision: source.ocrRevision,
      decision,
      quote,
      page: pages?.length === 1 ? (pages[0]?.page ?? null) : null,
    });
  }
  return [...links.values()];
}
