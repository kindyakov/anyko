import type { DocumentsModule } from '../../modules/documents';
import type { WorksModule } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

import { requireWorkDocument } from './require-work-document';

// Результат распознавания документа работы доступен с правом works.read.
export const getResult =
  (deps: { works: WorksModule; documents: DocumentsModule }) =>
  async (scope: WorkspaceScope, workId: WorkId, documentId: DocumentId) => {
    const ref = await requireWorkDocument(
      deps.works.queries,
      scope,
      workId,
      documentId,
    );
    return deps.documents.internal.queries.result(ref);
  };
