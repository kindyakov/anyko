import type { DocumentId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { createDocumentService } from './service';

type DocumentServiceApi = ReturnType<typeof createDocumentService>;

// Распознавание вне работы (термин глоссария): сценарии HTTP на модуле documents. Право
// recognitions.use проверяется здесь, а не в маршрутах. Работа и worker вызывают сервис напрямую:
// у них своё право и своя проверка (documents.upload, works.read и т. д.).
export function createRecognitions(service: DocumentServiceApi) {
  return {
    async list(scope: WorkspaceScope) {
      scope.require('recognitions.use');
      return service.list({ workspaceId: scope.workspaceId });
    },
    async pendingDeletions(scope: WorkspaceScope) {
      scope.require('recognitions.use');
      return service.pendingDeletions({ workspaceId: scope.workspaceId });
    },
    async upload(
      scope: WorkspaceScope,
      input: {
        filename: string;
        bytes: Uint8Array;
        correlationId: string;
        requestKey: string;
      },
    ) {
      scope.require('recognitions.use');
      return service.upload({
        ...input,
        workspaceId: scope.workspaceId,
        actorId: scope.userId,
      });
    },
    async get(scope: WorkspaceScope, documentId: DocumentId) {
      scope.require('recognitions.use');
      return service.get({ workspaceId: scope.workspaceId, documentId });
    },
    async result(scope: WorkspaceScope, documentId: DocumentId) {
      scope.require('recognitions.use');
      return service.result({ workspaceId: scope.workspaceId, documentId });
    },
    async source(scope: WorkspaceScope, documentId: DocumentId) {
      scope.require('recognitions.use');
      return service.source({ workspaceId: scope.workspaceId, documentId });
    },
    async image(scope: WorkspaceScope, documentId: DocumentId, index: number) {
      scope.require('recognitions.use');
      return service.image({
        workspaceId: scope.workspaceId,
        documentId,
        index,
      });
    },
    async deletion(scope: WorkspaceScope, documentId: DocumentId) {
      scope.require('recognitions.use');
      return service.deletion({ workspaceId: scope.workspaceId, documentId });
    },
    async remove(scope: WorkspaceScope, documentId: DocumentId) {
      scope.require('recognitions.use');
      return service.remove({
        workspaceId: scope.workspaceId,
        documentId,
        actorId: scope.userId,
      });
    },
    async retry(
      scope: WorkspaceScope,
      documentId: DocumentId,
      correlationId: string,
    ) {
      scope.require('recognitions.use');
      return service.retry({
        workspaceId: scope.workspaceId,
        documentId,
        actorId: scope.userId,
        correlationId,
      });
    },
  };
}

export type RecognitionService = ReturnType<typeof createRecognitions>;
