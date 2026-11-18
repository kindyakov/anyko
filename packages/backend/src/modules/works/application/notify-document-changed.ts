import type { WorkStore } from '..';

export const notifyDocumentChanged =
  (store: Pick<WorkStore, 'workForDocument' | 'event'>) =>
  async (workspaceId: string, documentId: string): Promise<void> => {
    const workId = await store.workForDocument(workspaceId, documentId);
    if (workId) await store.event(workspaceId, workId, 'documents.changed');
  };
