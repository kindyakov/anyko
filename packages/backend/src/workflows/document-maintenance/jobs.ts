import { z } from 'zod';

import type { SourceStorage } from '../../modules/documents';
import type { DocumentArtifacts } from '../../modules/processing';
import { defineJob } from '../../platform/jobs';

export function documentMaintenanceJob(deps: {
  processing: Pick<DocumentArtifacts, 'orphanResults' | 'forgetResult'>;
  storage: SourceStorage;
  deleteDocuments(): Promise<void>;
  cleanupSources(before: Date): Promise<void>;
}) {
  return defineJob({
    kind: 'scheduled',
    name: 'document.maintenance',
    version: 1,
    queue: 'maintenance',
    payload: z.object({}).strict(),
    timeoutMs: 300_000,
    retry: { attempts: 1, backoffMs: 0 },
    async handler(context) {
      await deps.deleteDocuments();
      const before = new Date(context.clock.now().getTime() - 3600000);
      await deps.cleanupSources(before);
      for (const artifact of await deps.processing.orphanResults(before)) {
        context.signal.throwIfAborted();
        await deps.storage.delete(artifact.key);
        await deps.processing.forgetResult(artifact.key);
      }
    },
  });
}
