import { z } from 'zod';

import { documentLockKey, type ResourceLocks } from '../../modules/documents';
import {
  type DocumentArtifacts,
  documentOcrPolicy,
  type ExecutionScope,
  type ProcessingIo,
} from '../../modules/processing';
import { defineJob } from '../../platform/jobs';

export function documentOcrJob(deps: {
  processing: Pick<DocumentArtifacts, 'documentId'>;
  locks: ResourceLocks;
  io: Pick<ProcessingIo, 'run'>;
  recognize(scope: ExecutionScope, signal: AbortSignal): Promise<void>;
  timeoutMs: number;
}) {
  return defineJob({
    kind: 'run',
    connection: 'none',
    ...documentOcrPolicy,
    version: 1,
    queue: 'ocr',
    payload: z.object({}).strict(),
    timeoutMs: deps.timeoutMs,
    retry: { attempts: 1, backoffMs: 0 },
    async handler(scope, _payload, signal) {
      const { workspaceId, runId } = scope;
      const documentId = await deps.processing.documentId(workspaceId, runId);
      if (!documentId) return;
      await deps.locks.run(
        documentLockKey(workspaceId, documentId),
        (lockSignal) =>
          deps.io.run({ kind: 'document', workspaceId, documentId }, () =>
            deps.recognize(scope, AbortSignal.any([signal, lockSignal])),
          ),
      );
    },
  });
}
