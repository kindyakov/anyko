import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { Database } from '@anyko/database';
import { createModelGateway } from '@anyko/llm';

import type { LlmSettingsStore } from '..';
import { type AuditWriter, record } from '../../audit';

export function createLlmSettingsStore(
  db: Pick<Database, 'llmSettings' | '$transaction'>,
  encryptionKey: string,
  write: AuditWriter = record,
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
  return {
    async current(workspaceId) {
      const row = await db.llmSettings.findFirst({
        where: { workspaceId },
        orderBy: { revision: 'desc' },
      });
      return row
        ? {
            revision: row.revision,
            baseURL: row.baseURL,
            visionModel: row.visionModel,
            extractionModel: row.extractionModel,
          }
        : null;
    },
    async connection(workspaceId, revision) {
      const row = await db.llmSettings.findUnique({
        where: { workspaceId_revision: { workspaceId, revision } },
      });
      if (!row) throw new Error('LLM_NOT_CONFIGURED');
      return {
        revision,
        baseURL: row.baseURL,
        visionModel: row.visionModel,
        extractionModel: row.extractionModel,
        connection: {
          id: 'routerai',
          baseURL: row.baseURL,
          apiKey: decrypt(workspaceId, row.encryptedKey),
        },
      };
    },
    async save(workspaceId, input, actorId) {
      const previous = await db.llmSettings.findFirst({
        where: { workspaceId },
        orderBy: { revision: 'desc' },
      });
      const apiKey =
        input.apiKey ??
        (previous ? decrypt(workspaceId, previous.encryptedKey) : '');
      // Validate both selections with the same client factory used by execution.
      const gateway = createModelGateway();
      for (const id of [input.visionModel, input.extractionModel])
        gateway.model(
          { id: 'routerai', baseURL: input.baseURL, apiKey },
          { id, images: true, tools: true, structuredOutput: true },
        );
      const revision = (previous?.revision ?? 0) + 1;
      // Настройки и событие журнала в одной транзакции. В журнал попадают только ревизия,
      // не ключ API и не адрес провайдера.
      await db.$transaction(async (tx) => {
        await tx.llmSettings.create({
          data: {
            workspaceId,
            revision,
            baseURL: input.baseURL,
            visionModel: input.visionModel,
            extractionModel: input.extractionModel,
            encryptedKey: encrypt(workspaceId, apiKey),
          },
        });
        await write(tx, {
          workspaceId,
          actorId,
          action: 'connections.settings_saved',
          target: { kind: 'workspace', id: workspaceId },
          data: { revision },
        });
      });
    },
  };
}
