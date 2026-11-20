import type { WorkDependencies } from '../work-dependencies';

import { confirmFacts } from './confirm-facts';
import { editChecklistLink } from './edit-checklist';
import { editValues, restoreField } from './edit-values';

type WorkReviewDeps = Pick<
  WorkDependencies,
  | 'uow'
  | 'works'
  | 'facts'
  | 'processing'
  | 'locks'
  | 'agents'
  | 'templateRequirements'
>;

// Процесс «проверка сведений»: юрист правит и подтверждает сведения работы.
export function createWorkReview(deps: WorkReviewDeps) {
  return {
    editValues: editValues(deps),
    restoreField: restoreField(deps),
    confirmFacts: confirmFacts(deps),
    editChecklistLink: editChecklistLink(deps),
  };
}
export type WorkReview = ReturnType<typeof createWorkReview>;
