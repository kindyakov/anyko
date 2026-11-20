import { listDocuments } from './application/list-documents';
import { listPendingDeletions } from './application/list-pending-deletions';
import type { DocumentDeps } from './application/ports';
import { readAnalysis, readAnalysisSource } from './application/read-analysis';
import { readDeletion } from './application/read-deletion';
import { readDeletionImpact } from './application/read-deletion-impact';
import { readDocument } from './application/read-document';
import { readImage } from './application/read-image';
import { readResult } from './application/read-result';
import { readSource } from './application/read-source';
import { removeDocument } from './application/remove';
import { retryDocument } from './application/retry';
import { uploadDocument } from './application/upload';

import type { DocumentsModule } from './index';

// Фабрика фасада: собирается в runtime (create-backend). Команды и запросы получают зависимости явно.
export function createDocumentsModule(deps: DocumentDeps): DocumentsModule {
  const upload = uploadDocument(deps);
  const remove = removeDocument(deps);
  const retry = retryDocument(deps);
  const get = readDocument(deps);
  const result = readResult(deps);
  const source = readSource(deps);
  const image = readImage(deps);
  return {
    commands: {
      upload: upload.recognition,
      remove: remove.recognition,
      retry: retry.recognition,
    },
    queries: {
      list: listDocuments(deps),
      pendingDeletions: listPendingDeletions(deps),
      get: get.recognition,
      result: result.recognition,
      source: source.recognition,
      image: image.recognition,
      deletion: readDeletion(deps),
      deletionImpact: readDeletionImpact(deps),
    },
    internal: {
      commands: {
        upload: upload.internal,
        remove: remove.internal,
        retry: retry.internal,
      },
      queries: {
        get: get.internal,
        result: result.internal,
        source: source.internal,
        image: image.internal,
        analysis: readAnalysis(deps),
        analysisSource: readAnalysisSource(deps),
      },
    },
  };
}
