import type { createAccess } from '@anyko/backend/access';
import type { RecognitionService } from '@anyko/backend/documents';
import type { LlmSettingsApi } from '@anyko/backend/processing';
import type { WorkApi } from '@anyko/backend/works';

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
    legacyScope: unused,
  };
  const documents: RecognitionService = {
    list: unused,
    pendingDeletions: unused,
    upload: unused,
    get: unused,
    result: unused,
    source: unused,
    image: unused,
    deletion: unused,
    remove: unused,
    retry: unused,
  };
  const works: WorkApi = {
    packages: unused,
    list: unused,
    create: unused,
    get: unused,
    upload: unused,
    removeDocument: unused,
    source: unused,
    image: unused,
    analyze: unused,
    edit: unused,
    confirm: unused,
    generate: unused,
    download: unused,
    events: unused,
  };
  const settings: LlmSettingsApi = {
    current: unused,
    save: unused,
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
      settings,
    },
  };
}
