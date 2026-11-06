import type { Logger } from '@anyko/logger';

import type { ResourceLocks, SourceStorage } from '../modules/documents';
export function createDocumentDeletionWorkflow(options: {
  pending: () => Promise<
    { id: string; workspaceId: string; requestKey: string }[]
  >;
  keys: (
    workspaceId: string,
    documentId: string,
    requestKey: string,
  ) => Promise<string[]>;
  resultKeys: (workspaceId: string, documentId: string) => Promise<string[]>;
  attemptIds: (workspaceId: string, documentId: string) => Promise<string[]>;
  eraseAttempt: (id: string) => Promise<void>;
  assertNoWriters: (
    workspaceId: string,
    documentId: string,
    requestKey: string,
  ) => Promise<void>;
  finish: (
    workspaceId: string,
    documentId: string,
    keys: string[],
  ) => Promise<void>;
  locks: ResourceLocks;
  storage: SourceStorage;
  logger: Logger;
}) {
  return async () => {
    for (const document of await options.pending()) {
      try {
        for (const id of await options.attemptIds(
          document.workspaceId,
          document.id,
        ))
          await options.eraseAttempt(id);
        await options.locks.run(
          `upload:${document.workspaceId}:${document.requestKey}`,
          () =>
            options.locks.run(
              `document:${document.workspaceId}:${document.id}`,
              async (signal) => {
                await options.storage.ready?.();
                await options.assertNoWriters(
                  document.workspaceId,
                  document.id,
                  document.requestKey,
                );
                const keys = [
                  ...new Set([
                    ...(await options.keys(
                      document.workspaceId,
                      document.id,
                      document.requestKey,
                    )),
                    ...(await options.resultKeys(
                      document.workspaceId,
                      document.id,
                    )),
                  ]),
                ];
                for (const key of keys) {
                  signal.throwIfAborted();
                  await options.storage.delete(key, signal);
                  if (await options.storage.exists(key))
                    throw new Error('DOCUMENT_ERASURE_UNCONFIRMED');
                }
                signal.throwIfAborted();
                await options.finish(document.workspaceId, document.id, keys);
              },
            ),
        );
      } catch {
        options.logger.warn({
          event: 'document_deletion_retry',
          jobId: document.id,
        });
      }
    }
  };
}
