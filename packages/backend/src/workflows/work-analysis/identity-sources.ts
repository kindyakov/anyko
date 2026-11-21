import type { WorkFacts } from '../../modules/facts';
import { russianPassportCitation } from '../../profiles/bfl/passport-evidence';

import type { ChecklistAnalysisSource } from './checklist-suggestions';

export function passportSourceIds(
  sources: readonly Pick<ChecklistAnalysisSource, 'id' | 'text'>[],
) {
  return new Set(
    sources
      .filter(({ text }) => russianPassportCitation(text))
      .map(({ id }) => id),
  );
}

export function passportCitizenshipCandidates(
  sources: readonly Pick<ChecklistAnalysisSource, 'id' | 'text'>[],
): WorkFacts['candidates'] {
  return sources.flatMap(({ id, text }) => {
    const quote = russianPassportCitation(text);
    return quote
      ? [
          {
            field: 'citizenship',
            value: 'Российская Федерация',
            origin: 'document',
            evidence: [{ documentId: id, imagePath: null, quote }],
          },
        ]
      : [];
  });
}
