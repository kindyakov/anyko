import type { FieldValue, FieldValues } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

import { sameFieldValue } from './field-value';

export type ReviewFilter = 'all' | 'attention';
export type ReviewField = {
  field: WorkView['package']['fields'][number];
  candidates: WorkView['facts']['candidates'];
  conflict: boolean;
  evidenceLost: boolean;
  attention: boolean;
};

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
      candidates.every(({ value }) =>
        sameFieldValue(value, candidates[0]?.value),
      ),
  );
  const total = view.package.fields.length;
  const complete = view.package.fields.filter(
    (field) => values[field.key] != null,
  ).length;
  return { attention, visible, quick, total, complete };
}
