import type { Database } from '@anyko/database';

export function createSourceWorkProcessing(
  db: Pick<Database, 'run' | 'runStep'>,
) {
  return {
    async activeWorks(workspaceId: string, workIds: string[]) {
      const runs = await db.run.findMany({
        where: {
          workspaceId,
          workId: { in: workIds },
          status: { in: ['queued', 'running'] },
        },
        distinct: ['workId'],
        select: { workId: true },
      });
      return new Set(runs.map(({ workId }) => workId));
    },
    async eraseSteps(
      workspaceId: string,
      documentId: string,
      workIds: string[],
    ) {
      await db.runStep.deleteMany({
        where: { workspaceId, documentId, run: { workId: { in: workIds } } },
      });
    },
  };
}
