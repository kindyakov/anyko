import type { Database } from '@anyko/database';

import type { JobRunReader } from '../application/job-scope';

export function createJobRunReader(db: Database): JobRunReader {
  return {
    async read(workspaceId, runId) {
      const run = await db.run.findFirst({
        where: {
          workspaceId,
          id: runId,
          OR: [{ documentId: null }, { document: { is: { deletedAt: null } } }],
        },
        select: {
          id: true,
          workspaceId: true,
          kind: true,
          correlationId: true,
          status: true,
          attemptToken: true,
        },
      });
      return (
        run && {
          workspaceId: run.workspaceId,
          runId: run.id,
          jobName: run.kind,
          correlationId: run.correlationId,
          status: run.status,
          attemptToken: run.attemptToken,
        }
      );
    },
  };
}
