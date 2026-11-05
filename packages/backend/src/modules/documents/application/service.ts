import { documentResultSchema } from './result-schema';
import type { DocumentStore, SourceStorage, DocumentView } from './ports';
import type { Logger } from '@anyko/logger';
export class DocumentError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_PDF'
      | 'NOT_FOUND'
      | 'NOT_READY'
      | 'RETRY_CONFLICT'
      | 'IDEMPOTENCY_CONFLICT',
    options?: ErrorOptions,
  ) {
    super(code, options);
  }
}
export function createDocumentService(
  store: DocumentStore,
  storage: SourceStorage,
  logger: Logger,
) {
  return {
    async upload(input: {
      workspaceId: string;
      actorId: string;
      filename: string;
      bytes: Uint8Array;
      correlationId: string;
      requestKey: string;
    }): Promise<DocumentView> {
      if (
        input.bytes.length < 5 ||
        input.bytes.length > 20 * 1024 * 1024 ||
        new TextDecoder().decode(input.bytes.slice(0, 5)) !== '%PDF-'
      )
        throw new DocumentError('INVALID_PDF');
      const id = crypto.randomUUID();
      const sourceKey = `sources/${input.workspaceId}/${id}.pdf`;
      const digest = await crypto.subtle.digest(
        'SHA-256',
        Uint8Array.from(input.bytes),
      );
      const sourceChecksum = Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
      await store.stageSource(sourceKey, input.workspaceId);
      await storage.put(sourceKey, input.bytes, 'application/pdf');
      try {
        return await store.register({
          id,
          runId: crypto.randomUUID(),
          workspaceId: input.workspaceId,
          filename: input.filename.slice(0, 200),
          sourceKey,
          sourceChecksum,
          size: input.bytes.length,
          actorId: input.actorId,
          correlationId: input.correlationId,
          requestKey: input.requestKey,
        });
      } catch (error) {
        logger.warn({
          event: 'source_registration_failed',
          correlationId: input.correlationId,
        });
        throw error;
      }
    },
    list(input: { workspaceId: string }) {
      return store.list(input.workspaceId);
    },
    async get(input: { workspaceId: string; documentId: string }) {
      const found = await store.get(input.workspaceId, input.documentId);
      if (!found) throw new DocumentError('NOT_FOUND');
      return found;
    },
    async result(input: { workspaceId: string; documentId: string }) {
      const found = await store.get(input.workspaceId, input.documentId);
      if (!found) throw new DocumentError('NOT_FOUND');
      const key = await store.resultKey(input.workspaceId, input.documentId);
      if (!key) throw new DocumentError('NOT_READY');
      const bytes = await storage.get(key);
      if (bytes.length > 5 * 1024 * 1024) throw new Error('INVALID_ARTIFACT');
      return documentResultSchema.parse(
        JSON.parse(new TextDecoder().decode(bytes)) as unknown,
      );
    },
    async retry(input: {
      workspaceId: string;
      documentId: string;
      actorId: string;
      correlationId: string;
    }) {
      const result = await store.retry(
        input.workspaceId,
        input.documentId,
        input.actorId,
        input.correlationId,
      );
      if (!result) throw new DocumentError('RETRY_CONFLICT');
      return result;
    },
  };
}
