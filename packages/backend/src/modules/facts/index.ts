import {
  factsSchema,
  emptyFieldValues,
  technicalFields,
  type WorkFacts,
  type FieldValues,
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
  for (const key of technicalFields) {
    if (
      confirmed ||
      current.confirmed.includes(key) ||
      current.manual.includes(key)
    )
      continue;
    const distinct = [
      ...new Set(
        candidates
          .filter((candidate) => candidate.field === key)
          .map((candidate) => candidate.value),
      ),
    ];
    values[key] = distinct.length === 1 ? (distinct[0] ?? null) : null;
  }
  return factsSchema.parse({ ...current, values, candidates });
}

export function editFacts(current: WorkFacts, values: FieldValues): WorkFacts {
  const manual = new Set(current.manual);
  for (const key of technicalFields)
    if (values[key] !== current.values[key]) manual.add(key);
  return factsSchema.parse({ ...current, values, manual: [...manual] });
}

export function confirmFacts(current: WorkFacts): WorkFacts {
  return factsSchema.parse({ ...current, confirmed: [...technicalFields] });
}

export interface FactsStore {
  get(workspaceId: string, workId: string): Promise<WorkFacts>;
  save(workspaceId: string, workId: string, facts: WorkFacts): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}
