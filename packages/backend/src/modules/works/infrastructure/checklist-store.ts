import type { Database } from '@anyko/database';

import type { WorkStore } from '..';

export function createChecklistStore(
  db: Pick<Database, 'workChecklistLink'>,
): Pick<
  WorkStore,
  'checklistLinks' | 'saveChecklistLink' | 'replaceChecklistSuggestions'
> {
  return {
    checklistLinks: (workspaceId, workId) =>
      db.workChecklistLink.findMany({
        where: { workspaceId, workId },
        select: {
          requirementKey: true,
          documentId: true,
          ocrRevision: true,
          decision: true,
          quote: true,
          page: true,
        },
        orderBy: [{ requirementKey: 'asc' }, { documentId: 'asc' }],
      }),
    async saveChecklistLink(workspaceId, workId, link) {
      const { documentId, requirementKey, ...update } = link;
      await db.workChecklistLink.upsert({
        where: {
          workspaceId_workId_documentId_requirementKey: {
            workspaceId,
            workId,
            documentId,
            requirementKey,
          },
        },
        create: { workspaceId, workId, ...link },
        update,
      });
    },
    async replaceChecklistSuggestions(workspaceId, workId, documentIds, links) {
      await db.workChecklistLink.deleteMany({
        where: {
          workspaceId,
          workId,
          documentId: { in: documentIds },
          decision: { in: ['found', 'review'] },
        },
      });
      if (links.length)
        await db.workChecklistLink.createMany({
          data: links.map((link) => ({ workspaceId, workId, ...link })),
          skipDuplicates: true,
        });
    },
  };
}
