import {
  emptyFieldValues,
  factsSchema,
  fieldDefinitions,
  fieldIdentity,
  type FieldRow,
  type FieldValue,
  type FieldValues,
  readFieldValues,
  type WorkFacts,
} from '@anyko/contracts';

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
    const found = candidates
      .filter((candidate) => candidate.field === key)
      .map((candidate) => candidate.value);
    values[key] = reconcile(key, found);
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
