import { canonicalCalendarDate } from '@anyko/document-values/calendar-date';
import { canonicalMoneyAmount } from '@anyko/document-values/money';

import {
  automaticValue,
  valueWithRemainingEvidence,
} from '../../../profiles/bfl/automatic-value';
import {
  emptyFieldValues,
  fieldDefinitions,
  fieldIdentity,
  type FieldRow,
  type FieldValue,
  type FieldValues,
  isCalendarDateField,
  isRublesColumn,
  isRublesField,
  readFieldValues,
} from '../../../profiles/bfl/fields';
import { factsSchema, type WorkFacts } from '../schemas';

export function emptyFacts(): WorkFacts {
  return {
    version: 1,
    values: emptyFieldValues(),
    manual: [],
    confirmed: [],
    candidates: [],
  };
}

export function mergeCandidates(
  current: WorkFacts,
  candidates: WorkFacts['candidates'],
  confirmed: boolean,
  preserveExisting = false,
): WorkFacts {
  const values = { ...current.values };
  const confirmedFields = new Set(current.confirmed);
  for (const { key } of fieldDefinitions) {
    const saved = values[key] ?? null;
    const isConfirmed = confirmed || confirmedFields.has(key);
    if (
      (isConfirmed && (!preserveExisting || saved !== null)) ||
      current.needsReview?.includes(key) ||
      current.manual.includes(key)
    )
      continue;
    const proposals = candidates.filter((candidate) => candidate.field === key);
    const found = proposals.filter(({ origin }) => origin !== 'inference');
    if (!found.length && proposals.length) continue;
    const proposed =
      reconcileCandidates(key, found) === null
        ? null
        : reconcileCandidates(key, found, automaticValue);
    if (preserveExisting && saved !== null) {
      if (Array.isArray(saved) && Array.isArray(proposed))
        values[key] = reconcile(key, [saved, proposed]) ?? saved;
      continue;
    }
    values[key] = proposed;
    if (preserveExisting && proposed !== null) confirmedFields.delete(key);
  }
  return factsSchema.parse({
    ...current,
    values,
    candidates,
    confirmed: [...confirmedFields],
  });
}

/** Расхождения определяются по сохранённым сведениям и сведённым кандидатам. */
export function findFactDiscrepancies(current: WorkFacts) {
  return fieldDefinitions
    .filter(({ key }) => {
      const candidates = current.candidates.filter(
        (c) => c.field === key && reconcile(key, [c.value]) !== null,
      );
      if (!candidates.length) return false;
      const original = reconcileCandidates(key, candidates);
      if (original === null) return true;

      const manual = current.manual.includes(key);
      const saved = current.values[key] ?? null;
      if (manual && saved === null) return true;
      if (saved === null) return false;

      const comparableSaved = comparableFactValue(reconcile(key, [saved]));
      if (
        comparableFactValue(original) === comparableSaved ||
        candidates.some(
          ({ value }) =>
            comparableFactValue(reconcile(key, [value])) === comparableSaved,
        )
      )
        return false;
      const automatic = reconcileCandidates(key, candidates, automaticValue);
      return comparableFactValue(automatic) !== comparableSaved;
    })
    .map(({ key }) => key);
}

export function markSelectedCandidates({
  values,
  candidates,
  needsReview,
}: WorkFacts) {
  return candidates.map((candidate) => {
    const { field, value } = candidate;
    const saved = reconcile(field, [values[field] ?? null]);
    const selected =
      saved !== null &&
      !needsReview?.includes(field) &&
      (includesFactValue(field, saved, value) ||
        // Автозаполнение может опустить ячейку. Оно не скрывает сохранённое противоречие.
        (candidate.origin !== 'inference' &&
          reconcile(field, [saved, value]) !== null &&
          includesFactValue(field, saved, automaticValue(candidate))));
    return { ...candidate, selected };
  });
}

function includesFactValue(
  key: string,
  saved: FieldValue,
  proposed: FieldValue,
) {
  if (!Array.isArray(saved) || !Array.isArray(proposed))
    return saved === reconcile(key, [proposed]);
  return (
    comparableFactValue(reconcile(key, [saved, proposed])) ===
    comparableFactValue(saved)
  );
}

function reconcileCandidates(
  key: string,
  candidates: WorkFacts['candidates'],
  valueOf: (candidate: WorkFacts['candidates'][number]) => FieldValue = (
    candidate,
  ) => candidate.value,
): FieldValue {
  return reconcile(key, candidates.map(valueOf));
}

function comparableFactValue(value: FieldValue): string {
  return Array.isArray(value)
    ? JSON.stringify(value.map((row) => stable([row])).sort())
    : stable(value);
}

export function editFacts(current: WorkFacts, values: FieldValues): WorkFacts {
  const manual = new Set(current.manual);
  const next = readFieldValues(values);
  for (const { key } of fieldDefinitions) {
    const previous = current.values[key] ?? null;
    const value = next[key] ?? null;
    if (
      typeof value === 'string' &&
      (isCalendarDateField(key) || isRublesField(key))
    ) {
      const comparable = reconcile(key, [value]);
      if (comparable !== null)
        next[key] =
          comparable === reconcile(key, [previous]) ? previous : comparable;
    }
    if (Array.isArray(value)) {
      const normalized = value.map((row) => comparableRow(key, row));
      next[key] =
        Array.isArray(previous) &&
        stable(normalized) ===
          stable(previous.map((row) => comparableRow(key, row)))
          ? previous
          : normalized;
    }
    if (stable(next[key] ?? null) !== stable(previous)) manual.add(key);
  }
  return factsSchema.parse({ ...current, values: next, manual: [...manual] });
}

export function confirmFacts(current: WorkFacts): WorkFacts {
  return factsSchema.parse({
    ...current,
    confirmed: fieldDefinitions.map(({ key }) => key),
    ...(current.needsReview && { needsReview: [] }),
  });
}

type Candidate = WorkFacts['candidates'][number];
export type FactEvidence = Candidate['evidence'][number];

function supportedParts(
  field: Candidate['field'],
  saved: FieldValue,
  candidates: Candidate[],
  reviewed: boolean,
  reduced?: ReadonlySet<Candidate>,
) {
  const proposals = candidates
    .filter((candidate) => candidate.field === field)
    .map((candidate) => {
      if (reduced?.has(candidate))
        return valueWithRemainingEvidence(
          reviewed
            ? {
                ...candidate,
                evidence: candidate.evidence.map((entry) => ({
                  ...entry,
                  imagePath: null,
                })),
              }
            : candidate,
        );
      return reviewed ? candidate.value : automaticValue(candidate);
    });
  if (!Array.isArray(saved)) {
    const comparable = reconcile(field, [saved]);
    return new Set(
      comparable !== null &&
        proposals.some((value) => includesFactValue(field, comparable, value))
        ? ['value']
        : [],
    );
  }
  if (!saved.length)
    return new Set(
      proposals.some((value) => Array.isArray(value) && !value.length)
        ? ['absence']
        : [],
    );
  const rows = proposals.flatMap((value) =>
    Array.isArray(value) ? value.map((row) => comparableRow(field, row)) : [],
  );
  const identity = fieldIdentity(field);
  const rowKey = (row: FieldRow) => {
    const key = identity.map((column) => row[column]);
    return key.length && key.every((cell) => cell?.trim())
      ? JSON.stringify(key)
      : stable([
          Object.fromEntries(
            Object.entries(row).filter(([, cell]) => cell !== null),
          ),
        ]);
  };
  const supported = new Set<string>();
  for (const [index, original] of saved.entries()) {
    const row = comparableRow(field, original);
    const key = rowKey(row);
    const matching = rows.filter((candidate) => rowKey(candidate) === key);
    for (const [column, cell] of Object.entries(row))
      if (
        cell !== null &&
        matching.some((candidate) => candidate[column] === cell)
      )
        supported.add(`${String(index)}:${column}`);
  }
  return supported;
}

export function refreshFactEvidence(
  current: WorkFacts,
  refresh: (evidence: FactEvidence) => FactEvidence | null,
): WorkFacts {
  const lost = new Set<Candidate['field']>();
  const reduced = new Set<Candidate>();
  const candidates = current.candidates.flatMap((candidate) => {
    const evidence = candidate.evidence.flatMap(
      (entry) => refresh(entry) ?? [],
    );
    const refreshed = { ...candidate, evidence };
    if (evidence.length < candidate.evidence.length) {
      lost.add(candidate.field);
      if (candidate.origin === 'inference') return [];
      reduced.add(refreshed);
    }
    return evidence.length ? [refreshed] : [];
  });
  const needsReview = new Set(current.needsReview);
  for (const field of lost) {
    const value = current.values[field];
    if (value === null) continue;
    const reviewed =
      current.manual.includes(field) || current.confirmed.includes(field);
    const before = supportedParts(field, value, current.candidates, reviewed);
    const after = supportedParts(field, value, candidates, reviewed, reduced);
    if ([...before].some((part) => !after.has(part))) needsReview.add(field);
  }
  return factsSchema.parse({
    ...current,
    candidates,
    confirmed: current.confirmed.filter((key) => !needsReview.has(key)),
    needsReview: [...needsReview],
  });
}

function stable(value: FieldValue): string {
  if (Array.isArray(value))
    return JSON.stringify(
      value.map((row) =>
        Object.fromEntries(
          Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    );
  return JSON.stringify(value);
}
function comparableRow(field: string, row: FieldRow): FieldRow {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      value !== null && isRublesColumn(field, column)
        ? (canonicalMoneyAmount(value) ?? value)
        : value,
    ]),
  );
}
function reconcile(key: string, found: FieldValue[]): FieldValue {
  if (!found.length) return null;
  const isRows = (value: FieldValue): value is FieldRow[] =>
    Array.isArray(value);
  if (!found.every(isRows)) {
    const distinct = [
      ...new Set(
        found.flatMap((value) => {
          if (typeof value !== 'string') return [];
          const comparable = isCalendarDateField(key)
            ? canonicalCalendarDate(value)
            : isRublesField(key)
              ? canonicalMoneyAmount(value)
              : value;
          return comparable === undefined ? [] : [comparable];
        }),
      ),
    ];
    return distinct.length === 1 ? (distinct[0] ?? null) : null;
  }
  const rows = new Map<string, FieldRow>();
  if (
    found.some((value) => value.length === 0) &&
    found.some((value) => value.length > 0)
  )
    return null;
  for (const table of found)
    for (const supplied of table) {
      const row = comparableRow(key, supplied);
      const identity = fieldIdentity(key);
      const id =
        identity.length && identity.every((column) => row[column]?.trim())
          ? JSON.stringify(identity.map((column) => row[column]?.trim()))
          : stable([row]);
      const previous = rows.get(id);
      if (
        previous &&
        Object.keys(row).some(
          (column) =>
            previous[column] && row[column] && previous[column] !== row[column],
        )
      )
        return null;
      rows.set(id, {
        ...previous,
        ...Object.fromEntries(
          Object.entries(row).filter(([, value]) => value !== null),
        ),
      });
    }
  return [...rows.values()];
}
