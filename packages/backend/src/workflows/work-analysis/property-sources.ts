import { comparableText } from '@anyko/document-values/text-value';

import type { WorkFacts } from '../../modules/facts';
import { cadastralNumberCitations } from '../../profiles/bfl/cadastral-number';

import type { ChecklistAnalysisSource } from './checklist-suggestions';
import { locateEvidence } from './locate-evidence';

const egrnTitle =
  /(?:^|\n)[ \t#*]*выписка[ \t]+из[ \t]+(?:егрн|единого государственного реестра недвижимости)/iu;
const objectHeader =
  /(?:^|\n)[ \t|]*(?:вид|тип) объекта недвижимости(?=\s|:|\|)/iu;

export function withEgrnCadastre(
  candidates: WorkFacts['candidates'],
  sources: ChecklistAnalysisSource[],
): WorkFacts['candidates'] {
  const records = new Map(
    sources.flatMap(({ id, text }) => {
      if (!egrnTitle.test(text.slice(0, 2000))) return [];
      const citations = cadastralNumberCitations(text);
      return [
        [
          id,
          citations.map((citation, i) => ({
            ...citation,
            record: comparableText(
              text
                .slice(citation.offset + 1, citations[i + 1]?.offset)
                .split(objectHeader, 1)[0] ?? '',
            ),
          })),
        ],
      ];
    }),
  );
  return candidates.map((candidate) => {
    const { field, value, origin, evidence } = candidate;
    if (
      field !== 'realEstate' ||
      origin === 'inference' ||
      !Array.isArray(value) ||
      value.length !== 1
    )
      return candidate;
    const row = value[0];
    const source = evidence[0];
    const address = row?.address?.trim();
    if (
      !row ||
      !source ||
      !address ||
      evidence.some(({ documentId }) => documentId !== source.documentId)
    )
      return candidate;
    const citations = records
      .get(source.documentId)
      ?.filter(({ record }) => record.includes(comparableText(address)));
    const citation = citations?.length === 1 ? citations[0] : undefined;
    if (!citation) return candidate;
    const proof = {
      documentId: source.documentId,
      imagePath: null,
      quote: citation.quote,
    };
    return (
      locateEvidence(
        [
          {
            ...candidate,
            value: [{ ...row, identifier: citation.value }],
            evidence: evidence.some(({ quote }) =>
              quote.includes(citation.quote),
            )
              ? evidence
              : [...evidence.slice(0, 11), proof],
          },
        ],
        sources,
      )[0] ?? candidate
    );
  });
}
