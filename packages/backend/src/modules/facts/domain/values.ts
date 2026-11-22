import { formatPreviousNames } from '@anyko/document-values/bankruptcy-projection';
import { canonicalCalendarDate } from '@anyko/document-values/calendar-date';
import { canonicalMoneyAmount } from '@anyko/document-values/money';
import {
  containsCreditorRegistryCandidate,
  isBankObligation,
  sameObligation,
} from '@anyko/document-values/obligations';
import { comparableText } from '@anyko/document-values/text-value';

import {
  automaticValue,
  type debtSourceChecks,
  type FactSourceText,
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
import { isKnownObligationType } from '../../../profiles/bfl/obligation-type';
import {
  containsObligations,
  fillsObligationType,
  hasUnknownObligationType,
  reconcileObligations,
  supersedesObligation,
  usesBankObligations,
} from '../../../profiles/bfl/reconcile-obligations';
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
  excludedFields?: ReadonlySet<Candidate['field']>,
  passportIds?: ReadonlySet<string>,
  sourceChecks?: ReturnType<typeof debtSourceChecks>,
  sourceTexts?: readonly FactSourceText[],
): WorkFacts {
  const values = { ...current.values };
  const confirmedFields = new Set(current.confirmed);
  for (const { key } of fieldDefinitions) {
    if (excludedFields?.has(key)) continue;
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
    if (usesBankObligations(key, [saved, ...found.map(({ value }) => value)])) {
      const { value: proposed, missingCurrentBalance } = reconcileObligations(
        saved,
        found,
        sourceChecks,
        sourceTexts,
      );
      if (preserveExisting && Array.isArray(saved) && !missingCurrentBalance) {
        values[key] = [
          ...saved.map((old) =>
            Array.isArray(proposed)
              ? (proposed.find(
                  (row) =>
                    sameObligation(old, row) &&
                    (sourceChecks?.hasNewerBalance(old) ||
                      supersedesObligation(row, old) ||
                      fillsObligationType(row, old)),
                ) ?? old)
              : old,
          ),
          ...(Array.isArray(proposed)
            ? proposed.filter(
                (row) => !saved.some((old) => sameObligation(old, row)),
              )
            : []),
        ];
      } else {
        values[key] = proposed;
      }
      continue;
    }
    if (!found.length && proposals.length) continue;
    const supported = found
      .map((candidate) => ({
        value: automaticValue(candidate, { sources: sourceTexts }),
        evidence: candidate.evidence,
      }))
      .filter(({ value }) => value !== null);
    const proposed =
      key === 'employmentIncome' && ambiguousIncome(supported)
        ? null
        : reconcile(
            key,
            supported.map(({ value }) => value),
          );
    const passport = preferredPassportValue(key, proposed, found, passportIds);
    if (preserveExisting && saved !== null) {
      if (Array.isArray(saved) && Array.isArray(proposed))
        values[key] = reconcile(key, [saved, proposed]) ?? saved;
      if (passport !== undefined && includesFactValue(key, saved, passport))
        values[key] = passport;
      continue;
    }
    values[key] = passport ?? proposed;
    if (preserveExisting && proposed !== null) confirmedFields.delete(key);
  }
  return factsSchema.parse({
    ...current,
    values,
    candidates,
    confirmed: [...confirmedFields],
  });
}

function preferredPassportValue(
  key: string,
  proposed: FieldValue,
  candidates: WorkFacts['candidates'],
  passportIds: ReadonlySet<string> | undefined,
) {
  if (
    !passportIds?.size ||
    typeof proposed !== 'string' ||
    key === 'previousNames' ||
    isCalendarDateField(key) ||
    isRublesField(key)
  )
    return undefined;
  for (const candidate of candidates) {
    if (
      candidate.origin === 'context' ||
      !candidate.evidence.some(({ documentId }) => passportIds.has(documentId))
    )
      continue;
    const value = automaticValue(candidate);
    if (typeof value === 'string' && includesFactValue(key, proposed, value))
      return value;
  }
  return undefined;
}

/** Расхождения определяются по сохранённым сведениям и сведённым кандидатам. */
export function findFactDiscrepancies(current: WorkFacts) {
  return fieldDefinitions
    .filter(({ key }) => {
      const candidates = current.candidates.filter(
        (c) => c.field === key && reconcile(key, [c.value]) !== null,
      );
      if (!candidates.length) return false;
      const saved = current.values[key] ?? null;
      const documentCandidates = candidates.filter(
        ({ creditorSource }) => !creditorSource,
      );
      if (
        !current.confirmed.includes(key) &&
        candidates.some(
          (candidate) =>
            candidate.creditorSource &&
            !containsCreditorRegistryCandidate(saved, candidate.value),
        )
      )
        return true;
      if (!documentCandidates.length) return false;
      if (
        usesBankObligations(key, [
          saved,
          ...candidates.map(({ value }) => value),
        ])
      ) {
        if (!current.confirmed.includes(key) && hasUnknownObligationType(saved))
          return true;
        return documentCandidates.some(
          (candidate) => !matchesObligationCandidate(saved, candidate),
        );
      }
      const original = reconcileCandidates(key, documentCandidates);
      if (original === null && key !== 'citizenship') return true;

      const manual = current.manual.includes(key);
      if (manual && saved === null) return true;
      if (saved === null) return false;

      const comparableSaved = comparableFactValue(key, reconcile(key, [saved]));
      if (
        comparableFactValue(key, original) === comparableSaved ||
        candidates.some(
          ({ value }) =>
            comparableFactValue(key, reconcile(key, [value])) ===
            comparableSaved,
        )
      )
        return false;
      const automatic = reconcileCandidates(
        key,
        documentCandidates,
        automaticValue,
      );
      return comparableFactValue(key, automatic) !== comparableSaved;
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
      (candidate.creditorSource
        ? containsCreditorRegistryCandidate(saved, value)
        : usesBankObligations(field, [saved, value])
          ? matchesObligationCandidate(saved, candidate)
          : includesFactValue(field, saved, value) ||
            (candidate.origin !== 'inference' &&
              (field === 'citizenship' ||
                reconcile(field, [saved, value]) !== null) &&
              includesFactValue(field, saved, automaticValue(candidate))));
    return { ...candidate, selected };
  });
}

function matchesObligationCandidate(saved: FieldValue, candidate: Candidate) {
  const supported = automaticValue(candidate);
  // A less precise model label cannot hide a conflict with the quoted type.
  if (
    Array.isArray(supported) &&
    supported.some(({ type }) => isKnownObligationType(type))
  )
    return containsObligations(saved, supported);
  return (
    containsObligations(saved, candidate.value) ||
    containsObligations(saved, supported)
  );
}

function includesFactValue(
  key: string,
  saved: FieldValue,
  proposed: FieldValue,
) {
  if (!Array.isArray(saved) || !Array.isArray(proposed))
    return (
      comparableFactValue(key, saved) ===
      comparableFactValue(key, reconcile(key, [proposed]))
    );
  return (
    comparableFactValue(key, reconcile(key, [saved, proposed])) ===
    comparableFactValue(key, saved)
  );
}

function reconcileCandidates(
  key: string,
  candidates: WorkFacts['candidates'],
  valueOf: (candidate: WorkFacts['candidates'][number]) => FieldValue = (
    candidate,
  ) => candidate.value,
): FieldValue {
  return reconcile(
    key,
    candidates.map((candidate) => valueOf(candidate)),
  );
}

function comparableScalar(key: string, value: string): string {
  return comparableText(
    key === 'previousNames' ? formatPreviousNames(value) : value,
  );
}

function comparableFactValue(key: string, value: FieldValue): string {
  if (typeof value === 'string') return stable(comparableScalar(key, value));
  return Array.isArray(value)
    ? JSON.stringify(value.map((row) => stable([row])).sort())
    : stable(value);
}

export function editFacts(
  current: WorkFacts,
  values: Partial<FieldValues>,
): WorkFacts {
  const manual = new Set(current.manual);
  const next = readFieldValues({ ...current.values, ...values });
  for (const { key } of fieldDefinitions) {
    if (!Object.hasOwn(values, key)) continue;
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
      if (reduced?.has(candidate)) return valueWithRemainingEvidence(candidate);
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
    const matching = rows.filter((candidate) =>
      isBankObligation(row)
        ? sameObligation(row, candidate)
        : rowKey(candidate) === key,
    );
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
function ambiguousIncome(
  values: { value: FieldValue; evidence: Candidate['evidence'] }[],
): boolean {
  const seen = new Map<string, Set<string>>();
  return values.some(
    ({ value, evidence }) =>
      Array.isArray(value) &&
      value.some((row) => {
        const payment = JSON.stringify([
          comparableText(row.employer ?? ''),
          row.month?.trim(),
          row.code?.trim() ?? '',
        ]);
        const line = row.sourceLine?.trim() ?? '';
        const documents = line
          ? evidence
              .filter(({ quote }) => quote.includes(line))
              .map(({ documentId }) => documentId)
          : [];
        const prior = seen.get(payment);
        const common = prior
          ? documents.filter((id) => prior.has(id))
          : documents;
        if (prior && !common.length) return true;
        seen.set(payment, new Set(common));
        return false;
      }),
  );
}

function reconcile(key: string, found: FieldValue[]): FieldValue {
  if (!found.length) return null;
  const isRows = (value: FieldValue): value is FieldRow[] =>
    Array.isArray(value);
  if (!found.every(isRows)) {
    const distinct = new Map<string, string>();
    for (const value of found) {
      if (typeof value !== 'string') continue;
      const canonical = isCalendarDateField(key)
        ? canonicalCalendarDate(value)
        : isRublesField(key)
          ? canonicalMoneyAmount(value)
          : value;
      if (canonical === undefined) continue;
      const comparable = comparableScalar(key, canonical);
      if (!distinct.has(comparable)) distinct.set(comparable, canonical);
    }
    return distinct.size === 1
      ? (distinct.values().next().value ?? null)
      : null;
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
        key === 'employmentIncome'
          ? JSON.stringify([
              row.employer?.trim(),
              row.month?.trim(),
              row.code?.trim() ?? '',
              row.sourceLine?.trim() ?? '',
            ])
          : identity.length && identity.every((column) => row[column]?.trim())
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
