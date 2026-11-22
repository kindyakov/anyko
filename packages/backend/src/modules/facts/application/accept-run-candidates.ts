import type {
  AcceptedRunCandidates,
  AcceptRunCandidatesInput,
  FactsStore,
} from '..';
import { candidateIdentity } from '../domain/candidates';
import {
  findFactDiscrepancies,
  markSelectedCandidates,
} from '../domain/values';

import { projectRunFacts } from './project-run-facts';

// Вызывается внутри транзакции после ограждения попытки запуска сценарием.
export const acceptRunCandidates =
  ({ store }: { store: Pick<FactsStore, 'get' | 'save'> }) =>
  async (input: AcceptRunCandidatesInput): Promise<AcceptedRunCandidates> => {
    const { workspaceId, workId, fields } = input;
    const existing = await store.get(workspaceId, workId);
    const { next, extractionAccepted, contextAccepted, extraction, context } =
      projectRunFacts(existing, input);
    await store.save(workspaceId, workId, next);
    const proposalOutcomes: AcceptedRunCandidates['proposalOutcomes'] = [];
    const applied = new Set<string>();
    for (const [stage, proposals, rejected] of [
      ['extraction', extraction, !extractionAccepted],
      ['reconciliation', context ?? [], !contextAccepted],
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
