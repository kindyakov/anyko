import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { Database } from '@anyko/database';
import { createModelGateway } from '@anyko/llm';

import { ConnectionErrors, type LlmSettingsStore } from '..';
import { transactionHandle, type Tx } from '../../../platform/transactions';
type Connection = Pick<Database, 'llmSettings' | '$queryRaw'>;
export function createConnectionsStore(
  db: Connection,
  encryptionKey: string,
): LlmSettingsStore {
  if (!/^[a-f\d]{64}$/i.test(encryptionKey))
    throw new Error('INVALID_LLM_ENCRYPTION_KEY');
  const key = Buffer.from(encryptionKey, 'hex');
  const encrypt = (workspaceId: string, value: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(workspaceId));
    const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes]
      .map((part) => part.toString('base64url'))
      .join('.');
  };
  const decrypt = (workspaceId: string, value: string) => {
    const parts = value.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2])
      throw new Error('INVALID_ENCRYPTED_LLM_KEY');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(parts[0], 'base64url'),
    );
    decipher.setAAD(Buffer.from(workspaceId));
    decipher.setAuthTag(Buffer.from(parts[1], 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  };
  const latest = (workspaceId: string) =>
    db.llmSettings.findFirst({
      where: { workspaceId },
      orderBy: { revision: 'desc' },
    });
  // Serialize save/revoke/provision across replicas, including when the workspace has no revision yet.
  const lock = async (workspaceId: string) => {
    await db.$queryRaw`SELECT id FROM "AnykoWorkspace" WHERE id=${workspaceId} FOR UPDATE`;
  };
  return {
    lock,
    async current(workspaceId, rejectRevoked = false) {
      const row = await latest(workspaceId);
      if (rejectRevoked && row?.revokedAt)
        throw new ConnectionErrors.Failure('CONNECTION_REVOKED');
      return row && !row.revokedAt
        ? {
            revision: row.revision,
            baseURL: row.baseURL,
            visionModel: row.visionModel,
            extractionModel: row.extractionModel,
            visionDisableReasoning: row.visionDisableReasoning,
            extractionEnableReasoning: row.extractionEnableReasoning,
          }
        : null;
    },
    async connection(workspaceId, revision) {
      const row =
        revision === null
          ? await latest(workspaceId)
          : await db.llmSettings.findUnique({
              where: { workspaceId_revision: { workspaceId, revision } },
            });
      if (!row) throw new ConnectionErrors.Failure('LLM_NOT_CONFIGURED');
      if (row.revokedAt)
        throw new ConnectionErrors.Failure('CONNECTION_REVOKED');
      return {
        revision: row.revision,
        baseURL: row.baseURL,
        visionModel: row.visionModel,
        extractionModel: row.extractionModel,
        visionDisableReasoning: row.visionDisableReasoning,
        extractionEnableReasoning: row.extractionEnableReasoning,
        connection: {
          id: 'routerai',
          baseURL: row.baseURL,
          apiKey: decrypt(workspaceId, row.encryptedKey),
        },
      };
    },
    async save(workspaceId, input) {
      await lock(workspaceId);
      const previous = await latest(workspaceId);
      const apiKey =
        input.apiKey ??
        (previous && !previous.revokedAt
          ? decrypt(workspaceId, previous.encryptedKey)
          : '');
      const gateway = createModelGateway();
      for (const id of [input.visionModel, input.extractionModel])
        gateway.model(
          { id: 'routerai', baseURL: input.baseURL, apiKey },
          { id, images: true, tools: true, structuredOutput: true },
        );
      const revision = (previous?.revision ?? 0) + 1;
      const sameEndpoint =
        previous && !previous.revokedAt && previous.baseURL === input.baseURL;
      await db.llmSettings.create({
        data: {
          workspaceId,
          revision,
          baseURL: input.baseURL,
          visionModel: input.visionModel,
          extractionModel: input.extractionModel,
          visionDisableReasoning:
            input.visionDisableReasoning ??
            (sameEndpoint && previous.visionModel === input.visionModel
              ? previous.visionDisableReasoning
              : true),
          extractionEnableReasoning:
            input.extractionEnableReasoning ??
            (sameEndpoint && previous.extractionModel === input.extractionModel
              ? previous.extractionEnableReasoning
              : true),
          encryptedKey: encrypt(workspaceId, apiKey),
        },
      });
      return revision;
    },
    async revoke(workspaceId, now) {
      await lock(workspaceId);
      const row = await latest(workspaceId);
      if (!row) return null;
      const { count } = await db.llmSettings.updateMany({
        where: { workspaceId, revokedAt: null },
        data: { revokedAt: now, encryptedKey: '' },
      });
      return count === 0 ? null : { revision: row.revision, count };
    },
  };
}
export function connectionsStoreFor(
  tx: Tx,
  encryptionKey: string,
): LlmSettingsStore {
  return createConnectionsStore(
    transactionHandle<Connection>(tx),
    encryptionKey,
  );
}
