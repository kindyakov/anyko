import type { createAccess } from '@anyko/backend/access';
import type { ConnectionSettingsApi } from '@anyko/backend/connections';
import type { DocumentsModule } from '@anyko/backend/documents';
import type {
  WorkGeneration,
  WorkIntake,
  WorkReview,
  WorkViews,
} from '@anyko/backend/workflows';
import type { WorksModule } from '@anyko/backend/works';

import type { DocumentHttpOptions } from '../../src/http/routes/documents';
import type { WorkHttpOptions } from '../../src/http/routes/works';

import { memoryIdempotency } from './memory-idempotency';

// Тесты описаний не исполняют сценарии: маршруты регистрируются без вызова зависимостей.
// Заглушки только повторяют форму типов; если маршрут всё же вызван, тест падает явно.
const unused = (): never => {
  throw new Error('UNUSED_IN_ROUTE_REGISTRATION_TEST');
};

export function stubHttpOptions(): {
  documentHttp: DocumentHttpOptions;
  workHttp: WorkHttpOptions;
} {
  const access: ReturnType<typeof createAccess> = {
    handle: unused,
    session: unused,
    scope: unused,
  };
  const documents: DocumentsModule = {
    commands: { upload: unused, remove: unused, retry: unused },
    queries: {
      list: unused,
      pendingDeletions: unused,
      get: unused,
      result: unused,
      source: unused,
      image: unused,
      deletion: unused,
    },
    internal: {
      commands: { upload: unused, remove: unused, retry: unused },
      queries: {
        get: unused,
        result: unused,
        source: unused,
        image: unused,
        analysis: unused,
      },
    },
  };
  const works: WorksModule = {
    internal: {
      get: unused,
      documents: unused,
      workForDocument: unused,
      dirty: unused,
      touch: unused,
      event: unused,
      detachDeleted: unused,
      deletion: unused,
      requestDeletion: unused,
      pendingDeletions: unused,
      prepareDeletion: unused,
      failDeletion: unused,
      finishDeletion: unused,
    },
    commands: {
      create: unused,
      attachDocument: unused,
      bumpRevision: unused,
      recordEvent: unused,
    },
    queries: {
      list: unused,
      find: unused,
      sources: unused,
      hasActiveDocument: unused,
      cursor: unused,
      events: unused,
    },
    in: unused,
  };
  const views: WorkViews = {
    packages: unused,
    get: unused,
    source: unused,
    image: unused,
    result: unused,
  };
  const intake: WorkIntake = {
    createWork: unused,
    uploadDocument: unused,
    removeDocument: unused,
    analyzeWork: unused,
  };
  const review: WorkReview = {
    editValues: unused,
    confirmFacts: unused,
  };
  const generation: WorkGeneration = {
    startGeneration: unused,
    downloadResult: unused,
  };
  const settings: ConnectionSettingsApi = {
    current: unused,
    save: unused,
    revoke: unused,
  };
  const origin = 'http://localhost:3000';
  const documentHttp = {
    documents,
    access,
    origin,
    idempotency: memoryIdempotency(),
  };
  return {
    documentHttp,
    workHttp: {
      ...documentHttp,
      works,
      views,
      intake,
      deletion: { request: unused, status: unused, pending: unused },
      review,
      generation,
      settings,
    },
  };
}
