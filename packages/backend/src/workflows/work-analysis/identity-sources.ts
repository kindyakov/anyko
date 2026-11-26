import type { ChecklistAnalysisSource } from './checklist-suggestions';

export function passportSourceIds(
  sources: readonly Pick<ChecklistAnalysisSource, 'id' | 'text'>[],
  passportCitation?: (text: string) => string | undefined,
) {
  return new Set(
    sources.filter(({ text }) => passportCitation?.(text)).map(({ id }) => id),
  );
}
