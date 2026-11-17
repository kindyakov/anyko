import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';
import { DocumentError } from '../errors';
import type { DocumentUploadInput, InternalUploadInput } from '../index';

import type { DocumentDeps, DocumentView } from './ports';
import {
  matchesSourceFormat,
  sourceContentTypes,
  sourceFormatFromKey,
} from './source-format';

// Загрузка исходника. Право проверяет вызывающий: распознавание вне работы — recognitions.use,
// исходник работы — процесс work-intake (documents.upload) до вызова.
export const uploadDocument = (deps: DocumentDeps) => {
  const internal = async (
    input: InternalUploadInput,
  ): Promise<DocumentView> => {
    const format = sourceFormatFromKey(input.filename);
    if (!format) throw new DocumentError('UNSUPPORTED_DOCUMENT_FORMAT');
    if (!matchesSourceFormat(input.bytes, format))
      throw new DocumentError('INVALID_DOCUMENT');
    return deps.locks.run(
      `upload:${input.workspaceId}:${input.requestKey}`,
      async (signal) => {
        await deps.store.assertUploadAllowed(
          input.workspaceId,
          input.requestKey,
        );
        const id = deps.newId();
        return deps.io.run(
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
            const sourceChecksum = Array.from(new Uint8Array(digest), (value) =>
              value.toString(16).padStart(2, '0'),
            ).join('');
            await deps.store.stageSource(sourceKey, input.workspaceId);
            await deps.artifacts.stage({
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
            await deps.storage.put(
              sourceKey,
              input.bytes,
              sourceContentTypes[format],
              signal,
            );
            signal.throwIfAborted();
            try {
              const registered = await deps.store.register({
                id,
                runId: deps.newId(),
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
                await deps.storage.delete(sourceKey);
                await deps.artifacts.forget(sourceKey);
                await deps.store.forgetSource(sourceKey);
              }
              return registered;
            } catch (error) {
              deps.logger.warn({
                event: 'source_registration_failed',
                correlationId: input.correlationId,
              });
              throw error;
            }
          },
        );
      },
    );
  };
  return {
    internal,
    recognition: async (scope: WorkspaceScope, input: DocumentUploadInput) => {
      scope.require('recognitions.use');
      return internal({
        ...input,
        workspaceId: scope.workspaceId,
        actorId: scope.userId,
      });
    },
  };
};
