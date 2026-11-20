import type { FieldValue, FieldValues } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import { canonicalCalendarDate } from '@anyko/document-values/calendar-date';
import { canonicalMoneyAmount } from '@anyko/document-values/money';

import { sameFieldValue } from './field-value';

export type ReviewFilter = 'all' | 'attention';
export type ReviewField = {
  field: WorkView['package']['fields'][number];
  candidates: WorkView['facts']['candidates'];
  conflict: boolean;
  evidenceLost: boolean;
  attention: boolean;
};

export function normalizedReviewValue<T extends FieldValue | undefined>(
  field: ReviewField['field'],
  value: T,
): FieldValue | T {
  if (typeof value !== 'string') return value;
  if (field.valueType === 'date') return canonicalCalendarDate(value) ?? value;
  if (field.valueType === 'money') return canonicalMoneyAmount(value) ?? value;
  return value;
}

export function invalidReviewValue(
  field: ReviewField['field'],
  value: FieldValue,
): boolean {
  return (
    typeof value === 'string' &&
    ((field.valueType === 'date' &&
      canonicalCalendarDate(value) === undefined) ||
      (field.valueType === 'money' &&
        canonicalMoneyAmount(value) === undefined))
  );
}

export function candidateSelection(
  value: FieldValue | undefined,
  saved: FieldValue | undefined,
) {
  const unchanged = sameFieldValue(value, saved);
  return (candidate: ReviewField['candidates'][number]) =>
    unchanged ? candidate.selected : sameFieldValue(value, candidate.value);
}

export function reviewFields(
  view: WorkView,
  values: FieldValues,
  filter: ReviewFilter,
) {
  const conflicts = new Set(view.facts.discrepancyFields);
  const evidenceLost = new Set(view.facts.needsReview);
  const fields: ReviewField[] = view.package.fields.map((field) => {
    const candidates = view.facts.candidates.filter(
      ({ field: key }) => key === field.key,
    );
    const conflict = conflicts.has(field.key);
    const lost = evidenceLost.has(field.key);
    return {
      field,
      candidates,
      conflict,
      evidenceLost: lost,
      attention:
        conflict ||
        lost ||
        (view.facts.values[field.key] == null && candidates.length > 0),
    };
  });
  const attention = fields.filter((item) => item.attention);
  const withFindings = fields.filter(
    (item) => !item.attention && item.candidates.length,
  );
  const withoutFindings = fields.filter(
    (item) => !item.attention && !item.candidates.length,
  );
  const visible =
    filter === 'attention'
      ? attention
      : [...attention, ...withFindings, ...withoutFindings];
  const quick = fields.filter(
    ({ field, candidates, conflict, evidenceLost }) =>
      !conflict &&
      !evidenceLost &&
      values[field.key] == null &&
      candidates.length > 0 &&
      candidates.every(
        ({ origin, value }) =>
          origin !== 'inference' &&
          !invalidReviewValue(field, value) &&
          sameFieldValue(
            normalizedReviewValue(field, value),
            normalizedReviewValue(field, candidates[0]?.value),
          ),
      ),
  );
  const total = view.package.fields.length;
  const complete = view.package.fields.filter(
    (field) => values[field.key] != null,
  ).length;
  return { attention, visible, quick, total, complete };
}
