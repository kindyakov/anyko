import type { DocumentService } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork } from '../work-guards';

import { requireAttachedDocument } from './get-source';

// Результат распознавания исходного документа работы. Право и проверка принадлежности — как у исходника:
// документ другой работы и удалённый документ не существуют. Сам результат читает сервис документов,
// а не распознавание вне работы: право recognitions.use здесь не нужно.
export const getResult =
  (deps: { works: WorksModule; documents: DocumentService }) =>
  async (scope: WorkspaceScope, workId: WorkId, documentId: DocumentId) => {
    scope.require('works.read');
    await requireWork(deps.works.queries, scope, workId);
    await requireAttachedDocument(deps.works, scope, workId, documentId);
    return deps.documents.result({
      workspaceId: scope.workspaceId,
      documentId,
    });
  };
