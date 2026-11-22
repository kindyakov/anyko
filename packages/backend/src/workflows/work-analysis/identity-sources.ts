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
