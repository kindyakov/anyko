import type { createAccess } from '@anyko/backend/access';
import type { DocumentService } from '@anyko/backend/documents';
import type { LlmSettingsStore } from '@anyko/backend/processing';
import type { WorkApi } from '@anyko/backend/works';

import type { DocumentHttpOptions } from '../../src/http/routes/documents';
import type { WorkHttpOptions } from '../../src/http/routes/works';

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
    canManage: unused,
    session: unused,
  };
  const documents: DocumentService = {
    source: unused,
    analysis: unused,
    upload: unused,
    list: unused,
    pendingDeletions: unused,
    get: unused,
    result: unused,
    image: unused,
    remove: unused,
    deletion: unused,
    retry: unused,
  };
  const works: WorkApi = {
    removeDocument: unused,
    packages: unused,
    list: unused,
    create: unused,
    get: unused,
    upload: unused,
    analyze: unused,
    edit: unused,
    confirm: unused,
    generate: unused,
    download: unused,
    events: unused,
  };
  const settings: Pick<LlmSettingsStore, 'current' | 'save'> = {
    current: unused,
    save: unused,
  };
  const origin = 'http://localhost:3000';
  const documentHttp = { documents, access, origin };
  return {
    documentHttp,
    workHttp: {
      ...documentHttp,
      works,
      settings,
      saveSettings: unused,
    },
  };
}
