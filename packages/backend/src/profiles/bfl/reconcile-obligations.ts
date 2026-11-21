import type { z } from 'zod';

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

import { automaticValue, hasUnambiguousBalanceDate } from './automatic-value';
import type { candidateSchema } from './candidate';
import type { FieldRow, FieldValue } from './fields';
import { isKnownObligationType } from './obligation-type';

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

export function fillsObligationType(next: FieldRow, previous: FieldRow) {
  return (
    sameBalance(next, previous) &&
    !isKnownObligationType(previous.type) &&
    isKnownObligationType(next.type)
  );
}

export function hasUnknownObligationType(value: FieldValue) {
  return (
    Array.isArray(value) &&
    value.some(
      (row) =>
        isBankObligation(row) &&
        row.debtStatus === obligationStatuses.active &&
        !isKnownObligationType(row.type),
    )
  );
}

function isClosure(row: FieldRow) {
  return (
    row.debtStatus === obligationStatuses.closed ||
    row.debtStatus === obligationStatuses.repaid
  );
}

function balanceDate(row: FieldRow) {
  const date = canonicalCalendarDate(row.amountDate ?? '');
  return date ? formatCalendarDate(date, 'YYYY-MM-DD') : '';
}

export function supersedesObligation(closure: FieldRow, older: FieldRow) {
  const olderDate = balanceDate(older);
  return isClosure(closure) && !!olderDate && balanceDate(closure) > olderDate;
}

type Candidate = z.infer<typeof candidateSchema>;

function latestActiveBalances(
  group: FieldRow[],
  sources: ReadonlyMap<FieldRow, Candidate['evidence']>,
) {
  const dated = group.map((row) => ({ row, date: balanceDate(row) }));
  if (
    dated.some(
      ({ row, date }) =>
        row.debtStatus !== obligationStatuses.active ||
        !date ||
        !hasUnambiguousBalanceDate(sources.get(row) ?? [], row),
    )
  )
    return group;
  const latest = dated.reduce(
    (date, next) => (next.date > date ? next.date : date),
    '',
  );
  return dated.filter(({ date }) => date === latest).map(({ row }) => row);
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
          (!isKnownObligationType(row.type) || row.type === previous.type) &&
          compatibleBreakdown(previous, row),
      ),
    )
  );
}

export function reconcileObligations(
  saved: FieldValue,
  candidates: Candidate[],
): FieldValue {
  const previous = Array.isArray(saved) ? saved : [];
  const groups: FieldRow[][] = [];
  const sources = new Map<FieldRow, Candidate['evidence']>();
  let observedAbsence = false;
  for (const candidate of candidates) {
    const proposal = automaticValue(candidate);
    if (!Array.isArray(proposal)) continue;
    if (!proposal.length) observedAbsence = true;
    for (const row of proposal) {
      sources.set(row, candidate.evidence);
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
    // When the contract has no saved balance, use only its newest documented date.
    const balances =
      !old && group.some((row) => !sameBalance(first, row))
        ? latestActiveBalances(group, sources)
        : group;
    const balance = balances[0];
    if (!balance) continue;
    if (
      balances.some((row) => !sameBalance(balance, row)) ||
      (old && isClosure(balance) && !sameBalance(old, balance))
    ) {
      if (old) accepted.push(old);
      continue;
    }
    const same = old && sameBalance(old, balance) ? old : balance;
    const types = new Set(group.flatMap(({ type }) => (type ? [type] : [])));
    const [type] = types;
    accepted.push(
      types.size === 1 && type && !isKnownObligationType(same.type)
        ? { ...same, type }
        : types.size > 1 && !old
          ? { ...same, type: null }
          : same,
    );
  }

  return accepted.length ? accepted : observedAbsence ? [] : null;
}
