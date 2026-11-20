import type {
  AcceptedRunCandidates,
  AcceptRunCandidatesInput,
  FactsStore,
} from '..';
import { candidateIdentity, combineCandidates } from '../domain/candidates';
import {
  findFactDiscrepancies,
  markSelectedCandidates,
  mergeCandidates,
} from '../domain/values';
// Вызывается внутри транзакции после ограждения попытки запуска сценарием.
export const acceptRunCandidates =
  ({ store }: { store: Pick<FactsStore, 'get' | 'save'> }) =>
  async ({
    workspaceId,
    workId,
    candidates,
    contextCandidates,
    fields,
    excludedFields,
    confirmed,
    preserveExisting,
  }: AcceptRunCandidatesInput): Promise<AcceptedRunCandidates> => {
    const existing = await store.get(workspaceId, workId);
    if (excludedFields?.size) {
      candidates = candidates.filter(({ field }) => !excludedFields.has(field));
      contextCandidates = contextCandidates?.filter(
        ({ field }) => !excludedFields.has(field),
      );
    }
    let selected = preserveExisting
      ? existing.candidates
      : combineCandidates(candidates);
    let extractionAccepted = !preserveExisting;
    let contextAccepted = false;
    try {
      selected = combineCandidates(candidates, existing.candidates);
      extractionAccepted = true;
      if (contextCandidates !== undefined) {
        selected = combineCandidates(selected, contextCandidates);
        contextAccepted = true;
      }
    } catch {
      // При выходе за бюджет остаётся последняя принятая группа кандидатов.
    }

    const next = mergeCandidates(
      existing,
      selected,
      confirmed,
      preserveExisting,
      excludedFields,
    );
    if (!contextAccepted) {
      // Необязательная стадия не стирает известные значения без новых кандидатов.
      for (const field of fields) {
        if (!selected.some((candidate) => candidate.field === field))
          next.values[field] = existing.values[field];
      }
    }
    await store.save(workspaceId, workId, next);
    const proposalOutcomes: AcceptedRunCandidates['proposalOutcomes'] = [];
    const applied = new Set<string>();
    for (const [stage, proposals, rejected] of [
      ['extraction', candidates, !extractionAccepted],
      ['reconciliation', contextCandidates ?? [], !contextAccepted],
    ] as const) {
      const before = markSelectedCandidates({
        ...existing,
        candidates: proposals,
      });
      const after = markSelectedCandidates({ ...next, candidates: proposals });
      for (const [
        index,
        { selected: included, ...candidate },
      ] of after.entries()) {
        const key = candidateIdentity(candidate);
        const status = rejected
          ? 'rejected'
          : !included
            ? 'review'
            : before[index]?.selected
              ? 'retained'
              : candidate.origin === 'inference' || applied.has(key)
                ? 'matched'
                : 'applied';
        proposalOutcomes.push({ stage, candidate, status });
        if (status === 'applied') applied.add(key);
      }
    }
    return {
      contextAccepted,
      proposalOutcomes,
      missingFields: fields.filter((field) => next.values[field] === null),
      discrepancyFields: findFactDiscrepancies(next).filter((field) =>
        fields.includes(field),
      ),
    };
  };
