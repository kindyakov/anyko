import { canonicalMoneyAmount } from '@anyko/document-values/money';
import {
  isBankObligation,
  obligationFields,
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
    if (group.some((row) => !sameBalance(first, row))) {
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
