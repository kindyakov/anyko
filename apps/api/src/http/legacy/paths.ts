import type { Endpoint } from '@anyko/contracts/common';
import {
  analyzeWork,
  createWork,
  generateWork,
  getWorkDocumentImage,
  getWorkDocumentSource,
} from '@anyko/contracts/works';

import type { RouteLayer } from '../route';

// Временный слой (удаляется вместе с web #11): прежние пути без версии и без области в адресе.
// Тот же набор обработчиков, что и в v1; отличаются только адрес и источник области.
// Новые документы работы прежних путей не имели и сюда не попадают.
const versionedOnly = new Set<Endpoint>([
  getWorkDocumentSource,
  getWorkDocumentImage,
]);
// Web пока не присылает Idempotency-Key для этих команд (ADR 0008); ключ остаётся необязательным,
// если пришёл — применяется тот же механизм. Загрузки этого списка не содержат: они требуют ключ.
const optionalKeyEndpoints = new Set<Endpoint>([
  createWork,
  analyzeWork,
  generateWork,
]);

const scopePrefix = '/workspaces/:workspaceId';
const recognitionsPrefix = '/recognitions';

export function legacyPathOf(endpoint: Endpoint): string | null {
  if (versionedOnly.has(endpoint)) return null;
  const withoutScope = endpoint.path.startsWith(scopePrefix)
    ? endpoint.path.slice(scopePrefix.length)
    : endpoint.path;
  // Распознавание вне работы прежде жило под `/documents`.
  return withoutScope.startsWith(recognitionsPrefix)
    ? `/documents${withoutScope.slice(recognitionsPrefix.length)}`
    : withoutScope;
}

export const legacyLayer: RouteLayer = {
  prefix: '/api',
  pathOf: legacyPathOf,
  keyOptional: (endpoint) => optionalKeyEndpoints.has(endpoint),
};
