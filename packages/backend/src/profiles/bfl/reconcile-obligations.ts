import {
  canonicalCalendarDate,
  formatCalendarDate,
} from '@anyko/document-values/calendar-date';
import { canonicalMoneyAmount } from '@anyko/document-values/money';
import {
  isBankObligation,
  obligationFields,
  obligationStatuses,
  sameObligation,
} from '@anyko/document-values/obligations';

import type { FieldRow, FieldValue } from './fields';

export function usesBankObligations(field: string, values: FieldValue[]) {
  return (
    obligationFields.some((key) => key === field) &&
    values.some((value) => Array.isArray(value) && value.some(isBankObligation))
  );
}

function sameBalance(a: FieldRow, b: FieldRow) {
  return (
    a.debtStatus === b.debtStatus &&
    canonicalMoneyAmount(a.amount ?? '') ===
      canonicalMoneyAmount(b.amount ?? '')
  );
}

function isClosure(row: FieldRow) {
  return (
    row.debtStatus === obligationStatuses.closed ||
    row.debtStatus === obligationStatuses.repaid
  );
}

export function supersedesObligation(closure: FieldRow, older: FieldRow) {
  if (!isClosure(closure)) return false;
  const closureDate = canonicalCalendarDate(closure.amountDate ?? '');
  const olderDate = canonicalCalendarDate(older.amountDate ?? '');
  return (
    !!closureDate &&
    !!olderDate &&
    formatCalendarDate(closureDate, 'YYYY-MM-DD') >
      formatCalendarDate(olderDate, 'YYYY-MM-DD')
  );
}

function compatibleBreakdown(a: FieldRow, b: FieldRow) {
  return ['arrears', 'penalties', 'interest'].every((key) => {
    const first = canonicalMoneyAmount(a[key] ?? '');
    const second = canonicalMoneyAmount(b[key] ?? '');
    return first === undefined || second === undefined || first === second;
  });
}

export function containsObligations(saved: FieldValue, proposed: FieldValue) {
  return (
    Array.isArray(saved) &&
    Array.isArray(proposed) &&
    proposed.length > 0 &&
    proposed.every((row) =>
      saved.some(
        (previous) =>
          sameObligation(previous, row) &&
          sameBalance(previous, row) &&
          compatibleBreakdown(previous, row),
      ),
    )
  );
}

export function reconcileObligations(
  saved: FieldValue,
  proposals: FieldValue[],
): FieldValue {
  const previous = Array.isArray(saved) ? saved : [];
  const groups: FieldRow[][] = [];
  for (const proposal of proposals) {
    if (!Array.isArray(proposal)) continue;
    for (const row of proposal) {
      const group = groups.find(
        ([first]) => first && sameObligation(first, row),
      );
      if (group) group.push(row);
      else groups.push([row]);
    }
  }

  const accepted: FieldRow[] = [];
  for (const group of groups) {
    const first = group[0];
    if (!first) continue;
    const old = previous.find((row) => sameObligation(row, first));
    const observations = old ? [...group, old] : group;
    const closure = group.find(
      (row) =>
        isClosure(row) &&
        observations.every(
          (observation) =>
            sameBalance(row, observation) ||
            supersedesObligation(row, observation),
        ),
    );
    if (
      closure &&
      observations.some((row) => supersedesObligation(closure, row))
    ) {
      accepted.push(closure);
      continue;
    }
    if (
      group.some((row) => !sameBalance(first, row)) ||
      (old && isClosure(first) && !sameBalance(old, first))
    ) {
      if (old) accepted.push(old);
      continue;
    }
    accepted.push(old && sameBalance(old, first) ? old : first);
  }

  return accepted.length
    ? accepted
    : proposals.some((value) => Array.isArray(value) && !value.length)
      ? []
      : null;
}
