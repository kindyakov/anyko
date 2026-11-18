import type {
  AcceptedRunCandidates,
  AcceptRunCandidatesInput,
  FactsStore,
} from '..';
import { combineCandidates } from '../domain/candidates';
import { findFactDiscrepancies, mergeCandidates } from '../domain/values';
// Вызывается внутри транзакции после ограждения попытки запуска сценарием.
export const acceptRunCandidates =
  ({ store }: { store: Pick<FactsStore, 'get' | 'save'> }) =>
  async ({
    workspaceId,
    workId,
    candidates,
    contextCandidates,
    fields,
    confirmed,
  }: AcceptRunCandidatesInput): Promise<AcceptedRunCandidates> => {
    const existing = await store.get(workspaceId, workId);
    let selected = combineCandidates(candidates);
    let contextAccepted = false;
    try {
      selected = combineCandidates(selected, existing.candidates);
      if (contextCandidates !== undefined) {
        selected = combineCandidates(selected, contextCandidates);
        contextAccepted = true;
      }
    } catch {
      // При выходе за бюджет остаётся последняя принятая группа кандидатов.
    }

    const next = mergeCandidates(existing, selected, confirmed);
    if (!contextAccepted) {
      // Необязательная стадия не стирает известные значения без новых кандидатов.
      for (const field of fields) {
        if (!selected.some((candidate) => candidate.field === field))
          next.values[field] = existing.values[field];
      }
    }
    await store.save(workspaceId, workId, next);
    return {
      contextAccepted,
      missingFields: fields.filter((field) => next.values[field] === null),
      discrepancyFields: findFactDiscrepancies(next).filter((field) =>
        fields.includes(field),
      ),
    };
  };
