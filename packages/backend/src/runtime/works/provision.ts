import { createDatabase, createDatabasePool } from '@anyko/database';

import { record } from '../../modules/audit';
import { createAuditModule } from '../../modules/audit/module';
import {
  connectionsStoreFor,
  createConnectionsStore,
} from '../../modules/connections/infrastructure/store';
import { createConnectionsModule } from '../../modules/connections/module';
import { systemClock } from '../../platform/clock';
import { createUnitOfWork } from '../transactions';

/** Operator-only initial provisioning; existing workspace settings are preserved. */
export async function provisionLlm(options: {
  databaseUrl: string;
  encryptionKey: string;
  workspaceId: string;
  apiKey: string;
  baseURL: string;
  modelId: string;
}) {
  // One-shot process: a private pool, closed here, is the whole footprint.
  const pool = createDatabasePool(options.databaseUrl);
  const db = createDatabase(pool);
  try {
    const connections = createConnectionsModule({
      store: createConnectionsStore(db, options.encryptionKey),
      storeFor: (tx) => connectionsStoreFor(tx, options.encryptionKey),
      uow: createUnitOfWork(db),
      audit: createAuditModule({ connection: db, write: record }),
      clock: systemClock,
    });
    return await connections.provision(options.workspaceId, {
      baseURL: options.baseURL,
      apiKey: options.apiKey,
      visionModel: options.modelId,
      extractionModel: options.modelId,
    });
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
