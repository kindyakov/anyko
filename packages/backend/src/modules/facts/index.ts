import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import { automaticValue } from '../../profiles/bfl/automatic-value';
import {
  emptyFieldValues,
  fieldDefinitions,
  fieldIdentity,
  type FieldRow,
  type FieldValue,
  type FieldValues,
  readFieldValues,
} from '../../profiles/bfl/fields';

import { factsSchema, type WorkFacts } from './schemas';

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
): WorkFacts {
  const values = { ...current.values };
  for (const { key } of fieldDefinitions) {
    if (
      confirmed ||
      current.confirmed.includes(key) ||
      current.needsReview?.includes(key) ||
      current.manual.includes(key)
    )
      continue;
    const found = candidates.filter((candidate) => candidate.field === key);
    const proposed = reconcile(
      key,
      found.map((candidate) => candidate.value),
    );
    values[key] =
      proposed === null ? null : reconcile(key, found.map(automaticValue));
  }
  return factsSchema.parse({ ...current, values, candidates });
}

/** Use the same field/row reconciliation rules for status as for values. */
export function findFactConflicts(current: WorkFacts) {
  return fieldDefinitions
    .filter(({ key }) => {
      const proposals = current.candidates
        .filter((c) => c.field === key)
        .map((c) => c.value);
      if (!proposals.length) return false;
      const protectedValue = current.values[key];
      if (
        (current.manual.includes(key) || current.confirmed.includes(key)) &&
        protectedValue !== null
      )
        proposals.push(protectedValue);
      return reconcile(key, proposals) === null;
    })
    .map(({ key }) => key);
}

export function editFacts(current: WorkFacts, values: FieldValues): WorkFacts {
  const manual = new Set(current.manual);
  const next = readFieldValues(values);
  for (const { key } of fieldDefinitions)
    if (stable(next[key] ?? null) !== stable(current.values[key] ?? null))
      manual.add(key);
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
      if (!reviewed) return automaticValue(candidate);
      if (!reduced?.has(candidate)) return candidate.value;
      // A person can accept an image-backed value. Test the remaining quotes if part of its proof was lost.
      return automaticValue({
        ...candidate,
        evidence: candidate.evidence.map((entry) => ({
          ...entry,
          imagePath: null,
        })),
      });
    });
  if (!Array.isArray(saved))
    return new Set(proposals.includes(saved) ? ['value'] : []);
  const rows = proposals.flatMap((value) =>
    Array.isArray(value) ? value : [],
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
  for (const [index, row] of saved.entries()) {
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
function reconcile(key: string, found: FieldValue[]): FieldValue {
  if (!found.length) return null;
  const isRows = (value: FieldValue): value is FieldRow[] =>
    Array.isArray(value);
  if (!found.every(isRows)) {
    const distinct = [
      ...new Set(found.filter((value) => typeof value === 'string')),
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
    for (const row of table) {
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

export interface FactsStore {
  get(workspaceId: string, workId: string): Promise<WorkFacts>;
  save(workspaceId: string, workId: string, facts: WorkFacts): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}

// Фасад сведений. Правка и подтверждение меняют только сведения; ревизию работы меняет сценарий
// (workflows/work-review), потому что ревизия принадлежит works. Права works.edit проверяет команда.
interface FactsCommands {
  edit(
    scope: WorkspaceScope,
    input: { workId: WorkId; values: FieldValues },
  ): Promise<void>;
  confirm(scope: WorkspaceScope, input: { workId: WorkId }): Promise<void>;
}
// Запрос внутренний: право проверяет вызывающий сценарий.
interface FactsQueries {
  get(scope: WorkspaceScope, workId: WorkId): Promise<WorkFacts>;
}
export interface FactsPorts {
  readonly commands: FactsCommands;
  readonly queries: FactsQueries;
  // Внутренний порт исполнения: снимок и запись сведений вызывает процесс, который проверил право.
  readonly internal: Pick<FactsStore, 'get' | 'save' | 'erase'>;
}
export interface FactsModule extends FactsPorts {
  in(tx: Tx): FactsPorts;
}

export type { FieldValues } from '../../profiles/bfl/fields';
