import type { Database } from '@anyko/database';

import type { JobRunReader } from '../application/job-scope';

export function createJobRunReader(db: Database): JobRunReader {
  return {
    async read(workspaceId, runId, family) {
      if (family === 'document') {
        const run = await db.processingRun.findFirst({
          where: { workspaceId, id: runId, document: { deletedAt: null } },
        });
        return run
          ? {
              workspaceId: run.workspaceId,
              runId: run.id,
              correlationId: run.correlationId,
              jobName: 'document.ocr',
              status: run.status,
              attemptToken: run.attemptToken,
            }
          : null;
      }
      const run = await db.workRun.findFirst({
        where: { workspaceId, id: runId },
      });
      if (!run || (run.kind !== 'analysis' && run.kind !== 'generation'))
        return null;
      return {
        workspaceId: run.workspaceId,
        runId: run.id,
        correlationId: run.correlationId,
        jobName: run.kind === 'analysis' ? 'work.analysis' : 'work.generation',
        status: run.status,
        attemptToken: run.attemptToken,
      };
    },
  };
}
