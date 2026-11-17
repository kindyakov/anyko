import {
  createDatabase,
  createDatabasePool,
  createResourceLocks,
} from '@anyko/database';

import { createLlmSettingsStore } from '../../modules/processing/infrastructure/settings-store';

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
    const locks = createResourceLocks(pool);
    const settings = createLlmSettingsStore(db, options.encryptionKey);
    return await locks.run(`llm-settings:${options.workspaceId}`, async () => {
      if (await settings.current(options.workspaceId))
        return 'already-configured';
      await settings.save(options.workspaceId, {
        baseURL: options.baseURL,
        apiKey: options.apiKey,
        visionModel: options.modelId,
        extractionModel: options.modelId,
      });
      return 'configured';
    });
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
