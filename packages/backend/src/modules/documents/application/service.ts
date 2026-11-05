import { documentResultSchema } from './result-schema';
import { checksum } from './checksum';
import {
  matchesSourceFormat,
  sourceContentTypes,
  sourceFormatFromKey,
} from './source-format';
import type {
  DocumentStore,
  SourceStorage,
  DocumentView,
  ArtifactRegistry,
  ResourceLocks,
  DocumentIo,
} from './ports';
import type { Logger } from '@anyko/logger';
export class DocumentError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_DOCUMENT'
      | 'UNSUPPORTED_DOCUMENT_FORMAT'
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
  artifacts: ArtifactRegistry,
  locks: ResourceLocks,
  io: DocumentIo,
) {
  async function artifact(input: { workspaceId: string; documentId: string }) {
    const found = await store.get(input.workspaceId, input.documentId);
    if (!found) throw new DocumentError('NOT_FOUND');
    const key = await store.resultKey(input.workspaceId, input.documentId);
    if (!key) throw new DocumentError('NOT_READY');
    const bytes = await storage.get(key);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('INVALID_ARTIFACT');
    return documentResultSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    );
  }
  return {
    async source(input: { workspaceId: string; documentId: string }) {
      const row = await store.source(input.workspaceId, input.documentId);
      if (!row) throw new DocumentError('NOT_FOUND');
      const bytes = await storage.get(row.key);
      if (bytes.length !== row.size || (await checksum(bytes)) !== row.checksum)
        throw new Error('INVALID_SOURCE_ARTIFACT');
      const format = sourceFormatFromKey(row.filename);
      if (!format) throw new DocumentError('UNSUPPORTED_DOCUMENT_FORMAT');
      return {
        bytes,
        filename: row.filename,
        contentType: sourceContentTypes[format],
      };
    },
    async analysis(input: { workspaceId: string; documentId: string }) {
      const result = await artifact(input);
      const images = [];
      for (const image of result.images) {
        const bytes = await storage.get(image.key);
        if (
          bytes.length !== image.size ||
          (await checksum(bytes)) !== image.checksum
        )
          throw new Error('INVALID_IMAGE_ARTIFACT');
        images.push({
          path: image.path,
          bytes,
          contentType: image.contentType,
        });
      }
      return {
        text: result.markdown,
        images,
        sourceDigest: await checksum(
          new TextEncoder().encode(JSON.stringify(result)),
        ),
      };
    },
    async upload(input: {
      workspaceId: string;
      actorId: string;
      filename: string;
      bytes: Uint8Array;
      correlationId: string;
      requestKey: string;
    }): Promise<DocumentView> {
      const format = sourceFormatFromKey(input.filename);
      if (!format) throw new DocumentError('UNSUPPORTED_DOCUMENT_FORMAT');
      if (!matchesSourceFormat(input.bytes, format))
        throw new DocumentError('INVALID_DOCUMENT');
      return locks.run(
        `upload:${input.workspaceId}:${input.requestKey}`,
        async (signal) => {
          await store.assertUploadAllowed(input.workspaceId, input.requestKey);
          const id = crypto.randomUUID();
          return io.run(
            {
              workspaceId: input.workspaceId,
              documentId: id,
              requestKey: input.requestKey,
            },
            async () => {
              const sourceKey = `sources/${input.workspaceId}/${id}.${format}`;
              const digest = await crypto.subtle.digest(
                'SHA-256',
                Uint8Array.from(input.bytes),
              );
              const sourceChecksum = Array.from(
                new Uint8Array(digest),
                (value) => value.toString(16).padStart(2, '0'),
              ).join('');
              await store.stageSource(sourceKey, input.workspaceId);
              await artifacts.stage({
                key: sourceKey,
                workspaceId: input.workspaceId,
                documentId: id,
                requestKey: input.requestKey,
                kind: 'source',
                contentType: sourceContentTypes[format],
                size: input.bytes.length,
                checksum: sourceChecksum,
              });
              signal.throwIfAborted();
              await storage.put(
                sourceKey,
                input.bytes,
                sourceContentTypes[format],
                signal,
              );
              signal.throwIfAborted();
              try {
                const registered = await store.register({
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
                if (registered.id !== id) {
                  await storage.delete(sourceKey);
                  await artifacts.forget(sourceKey);
                  await store.forgetSource(sourceKey);
                }
                return registered;
              } catch (error) {
                logger.warn({
                  event: 'source_registration_failed',
                  correlationId: input.correlationId,
                });
                throw error;
              }
            },
          );
        },
      );
    },
    list(input: { workspaceId: string }) {
      return store.list(input.workspaceId);
    },
    pendingDeletions(input: { workspaceId: string }) {
      return store.pendingDeletions(input.workspaceId);
    },
    async get(input: { workspaceId: string; documentId: string }) {
      const found = await store.get(input.workspaceId, input.documentId);
      if (!found) throw new DocumentError('NOT_FOUND');
      return found;
    },
    async result(input: { workspaceId: string; documentId: string }) {
      const result = await artifact(input);
      return {
        markdown: result.markdown,
        processorVersion: result.processorVersion,
        images: result.images.map((image, index) => ({
          path: image.path,
          url: `/api/documents/${encodeURIComponent(input.documentId)}/images/${String(index)}`,
        })),
      };
    },
    async image(input: {
      workspaceId: string;
      documentId: string;
      index: number;
    }) {
      const image = await store.image(
        input.workspaceId,
        input.documentId,
        input.index,
      );
      if (!image) throw new DocumentError('NOT_FOUND');
      const bytes = await storage.get(image.key);
      if (
        bytes.length !== image.size ||
        (await checksum(bytes)) !== image.checksum
      )
        throw new Error('INVALID_IMAGE_ARTIFACT');
      return {
        bytes,
        contentType: image.contentType,
      };
    },
    async remove(input: { workspaceId: string; documentId: string }) {
      if (!(await store.remove(input.workspaceId, input.documentId)))
        throw new DocumentError('NOT_FOUND');
    },
    async deletion(input: { workspaceId: string; documentId: string }) {
      const status = await store.deletion(input.workspaceId, input.documentId);
      if (!status) throw new DocumentError('NOT_FOUND');
      return { status };
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
