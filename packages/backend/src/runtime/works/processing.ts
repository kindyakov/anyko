import type { Database } from '@anyko/database';

import {
  createWorkProcessingStore,
  workProcessingStoreFor,
} from '../../modules/processing/infrastructure/work-store';
import { createProcessingModule } from '../../modules/processing/module';
import { uuidV7 } from '../../platform/ids';
import type { UnitOfWork } from '../../platform/transactions';

export function createWorkProcessing(db: Database, uow: UnitOfWork) {
  return createProcessingModule({
    uow,
    store: createWorkProcessingStore(db),
    storeFor: workProcessingStoreFor,
    newId: uuidV7,
  });
}
