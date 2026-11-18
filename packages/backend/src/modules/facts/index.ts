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
      current.manual.includes(key)
    )
      continue;
    const found = candidates.filter((candidate) => candidate.field === key);
    values[key] =
      reconcileCandidates(key, found) === null
        ? null
        : reconcileCandidates(key, found, automaticValue);
  }
  return factsSchema.parse({ ...current, values, candidates });
}

/** Расхождения определяются по сохранённым сведениям и сведённым кандидатам. */
export function findFactDiscrepancies(current: WorkFacts) {
  return fieldDefinitions
    .filter(({ key }) => {
      const candidates = current.candidates.filter((c) => c.field === key);
      if (!candidates.length) return false;
      if (reconcileCandidates(key, candidates) === null) return true;

      const manual = current.manual.includes(key);
      if (!manual && !current.confirmed.includes(key)) return false;
      const saved = current.values[key] ?? null;
      if (manual && saved === null) return true;

      const proposed = reconcileCandidates(key, candidates, automaticValue);
      return (
        comparableFactValue(proposed) !==
        comparableFactValue(reconcile(key, [saved]))
      );
    })
    .map(({ key }) => key);
}

export function markSelectedCandidates({ values, candidates }: WorkFacts) {
  return candidates.map((candidate) => {
    const { field, value } = candidate;
    const saved = reconcile(field, [values[field] ?? null]);
    const selected =
      saved !== null &&
      (includesFactValue(field, saved, value) ||
        includesFactValue(field, saved, automaticValue(candidate)));
    return { ...candidate, selected };
  });
}

function includesFactValue(
  key: string,
  saved: FieldValue,
  proposed: FieldValue,
) {
  if (!Array.isArray(saved) || !Array.isArray(proposed))
    return saved === proposed;
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
  for (const { key } of fieldDefinitions)
    if (stable(next[key] ?? null) !== stable(current.values[key] ?? null))
      manual.add(key);
  return factsSchema.parse({ ...current, values: next, manual: [...manual] });
}

export function confirmFacts(current: WorkFacts): WorkFacts {
  return factsSchema.parse({
    ...current,
    confirmed: fieldDefinitions.map(({ key }) => key),
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
