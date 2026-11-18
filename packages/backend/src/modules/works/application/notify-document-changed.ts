import type { WorkStore } from '..';

export const notifyDocumentChanged =
  (store: Pick<WorkStore, 'worksForDocument' | 'pinPending' | 'event'>) =>
  async (
    workspaceId: string,
    documentId: string,
    readyRevision?: number,
  ): Promise<void> => {
    const workIds = await store.worksForDocument(workspaceId, documentId);
    if (workIds.length && readyRevision !== undefined)
      await store.pinPending(workspaceId, documentId, readyRevision);
    for (const workId of workIds)
      await store.event(workspaceId, workId, 'documents.changed');
  };
