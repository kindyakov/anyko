import type { DocumentsModule } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

import { requireWorkDocument } from './require-work-document';

// Исходный файл документа работы. Документ другой работы и удалённый документ не существуют.
export const getSource =
  (deps: { works: WorksModule; documents: DocumentsModule }) =>
  async (scope: WorkspaceScope, workId: WorkId, documentId: DocumentId) => {
    const ref = await requireWorkDocument(
      deps.works.queries,
      scope,
      workId,
      documentId,
    );
    return deps.documents.internal.queries.source(ref);
  };
