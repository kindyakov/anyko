import type { WorkDependencies } from '../work-dependencies';

import { confirmFacts } from './confirm-facts';
import { editValues, restoreField } from './edit-values';

type WorkReviewDeps = Pick<
  WorkDependencies,
  'uow' | 'works' | 'facts' | 'processing' | 'locks' | 'agents'
>;

// Процесс «проверка сведений»: юрист правит и подтверждает сведения работы.
export function createWorkReview(deps: WorkReviewDeps) {
  return {
    editValues: editValues(deps),
    restoreField: restoreField(deps),
    confirmFacts: confirmFacts(deps),
  };
}
export type WorkReview = ReturnType<typeof createWorkReview>;
