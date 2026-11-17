import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import type { UnitOfWork } from '../../platform/transactions';

import { confirmFacts } from './confirm-facts';
import { editValues } from './edit-values';

export interface WorkReviewDeps {
  uow: UnitOfWork;
  works: WorksModule;
  facts: FactsModule;
  processing: ProcessingModule;
  locks: ResourceLocks;
}

// Процесс «проверка сведений»: юрист правит и подтверждает сведения работы.
export function createWorkReview(deps: WorkReviewDeps) {
  return {
    editValues: editValues(deps),
    confirmFacts: confirmFacts(deps),
  };
}
export type WorkReview = ReturnType<typeof createWorkReview>;
