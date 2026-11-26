import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import { hasSubmittedAttachments } from '@anyko/document-values/attachments';
import {
  familyStatementNeedsReview,
  statementDefaultValue,
} from '@anyko/document-values/bankruptcy-projection';
import { canonicalCalendarDate } from '@anyko/document-values/calendar-date';
import { canonicalMoneyAmount } from '@anyko/document-values/money';
import {
  applyCreditorRegistryCandidate,
  applyObligationCandidate,
  isBankObligation,
  obligationFields,
} from '@anyko/document-values/obligations';
import { isDatedBankruptcyPackage } from '@anyko/document-values/statement-layout';
import { comparableText } from '@anyko/document-values/text-value';

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
    unchanged ? candidate.selected : sameReviewValue(value, candidate.value);
}

export function sameReviewValue(
  a: FieldValue | undefined,
  b: FieldValue | undefined,
): boolean {
  return typeof a === 'string' && typeof b === 'string'
    ? comparableText(a) === comparableText(b)
    : sameFieldValue(a, b);
}

export function reviewCandidateValue(
  key: FieldKey,
  current: FieldValue | undefined,
  value: FieldValue,
  registry: boolean,
) {
  if (!Array.isArray(value)) return value;
  if (registry) return applyCreditorRegistryCandidate(current, value) ?? null;
  return obligationFields.some((field) => field === key) &&
    value.some(isBankObligation)
    ? applyObligationCandidate(current, value)
    : value;
}

export function reviewFields(
  view: WorkView,
  values: FieldValues,
  filter: ReviewFilter,
) {
  const conflicts = new Set(view.facts.discrepancyFields);
  const evidenceLost = new Set(view.facts.needsReview);
  const reviewable = hasSubmittedAttachments(view.package.fields)
    ? view.package.fields.filter(
        ({ key }) => key !== 'attachments' && key !== 'submittedAttachments',
      )
    : view.package.fields;
  const fields: ReviewField[] = reviewable.map((field) => {
    const candidates = view.facts.candidates.filter(
      ({ field: key }) => key === field.key,
    );
    const conflict = conflicts.has(field.key);
    const lost = evidenceLost.has(field.key);
    const current = values[field.key];
    return {
      field,
      candidates,
      conflict,
      evidenceLost: lost,
      attention:
        conflict ||
        lost ||
        (field.key === 'familyDetails' &&
          typeof current === 'string' &&
          familyStatementNeedsReview(current)) ||
        (isDatedBankruptcyPackage(view.package.version) &&
          statementDefaultValue(values, field.key) !== undefined) ||
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
          sameReviewValue(
            normalizedReviewValue(field, value),
            normalizedReviewValue(field, candidates[0]?.value),
          ),
      ),
  );
  const total = reviewable.length;
  const complete = reviewable.filter(
    (field) => values[field.key] != null,
  ).length;
  return { attention, visible, quick, total, complete };
}

/** Краткая сводка проверки для шагов работы: заполнено, всего и сколько полей требуют внимания. */
export function reviewSummary(view: WorkView, values: FieldValues) {
  const { attention, total, complete } = reviewFields(view, values, 'all');
  return { attention: attention.length, total, complete };
}
