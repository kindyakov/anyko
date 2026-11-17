import { expect, test } from 'bun:test';

import { z } from 'zod';

import {
  type Endpoint,
  listQueryMode,
  listResponseMode,
} from '@anyko/contracts/common';

import { type NamedEndpoint, namedEndpoints } from './support/endpoints';

// Ключи — существительные во множественном числе, значения — ресурс для сверки веток.
const collections = new Map([
  ['workspaces', 'workspace'],
  ['document-packages', 'document-package'],
  ['works', 'work'],
  ['recognitions', 'document'],
  ['documents', 'document'],
  ['images', 'image'],
  ['events', 'event'],
  ['generations', 'generation'],
  ['files', 'file'],
]);
const singletons = new Set([
  'session',
  'result',
  'source',
  'fields',
  'deletion',
]);
const actions = new Set(['analyze', 'confirm', 'generate', 'retry']);
const globals = new Map([
  ['GET /session', 'Сессия перечисляет области до выбора текущей области'],
  ['GET /document-packages', 'Один каталог шаблонов для всех рабочих областей'],
]);

const legacy = {
  fields: {
    address: 'POST /workspaces/:workspaceId/works/:workId/fields',
    reason: 'У клиента уже есть команда правки с проверкой ревизии через POST',
    action: 'Перейти на PATCH вместе с контрактом и клиентом',
  },
  connections: {
    path: '/workspaces/:workspaceId/settings/llm',
    methods: ['GET', 'POST', 'DELETE'],
    reason: 'Адрес появился до выделения модуля connections',
    action:
      'Согласовать адрес /connections/llm и переход на PUT для сохранения',
  },
  lists: {
    listDocuments: {
      address: 'GET /workspaces/:workspaceId/recognitions',
      reason:
        'Возвращает documents и pendingDeletions для экрана распознавания',
      action:
        'Согласовать пагинацию и представление ожидающих удалений вместе с клиентом',
    },
    listDocumentPackages: {
      address: 'GET /document-packages',
      reason:
        'Возвращает весь ограниченный каталог доступных шаблонов в packages',
      action: 'Решить на review, закрепить ли непагинированный каталог',
    },
  },
} as const;

const declaredOverlaps = [
  {
    pair: ['getDocumentResult', 'getWorkDocumentResult'],
    reason:
      'У распознавания работы отдельная проверка принадлежности и ссылки на её изображения',
  },
  {
    pair: ['getDocumentSource', 'getWorkDocumentSource'],
    reason:
      'Скачивание исходника работы требует его принадлежности этой работе',
  },
  {
    pair: ['getDocumentImage', 'getWorkDocumentImage'],
    reason:
      'Ссылки из результата работы проверяют принадлежность изображения документу этой работы',
  },
  {
    pair: ['uploadDocument', 'uploadWorkDocument'],
    reason:
      'Загрузка в работу привязывает исходник к работе и проверяет её состояние',
  },
  {
    pair: ['deleteDocument', 'removeWorkDocument'],
    reason:
      'Удаление исходника работы меняет её состав, автономное распознавание работы не имеет',
  },
] as const;

const address = ({ method, path }: Endpoint) => `${method} ${path}`;
const label = ({ name, endpoint }: NamedEndpoint) =>
  `${name} (${address(endpoint)})`;
const isParameter = (segment: string) => segment.startsWith(':');
const normalize = (segment: string) => (isParameter(segment) ? ':' : segment);

const entries = namedEndpoints().map((entry) => ({
  ...entry,
  segments: entry.endpoint.path.slice(1).split('/'),
}));
type Entry = (typeof entries)[number];

function* pairs() {
  for (const [index, left] of entries.entries())
    for (const right of entries.slice(index + 1)) yield [left, right] as const;
}

test('static path segments use kebab-case', () => {
  for (const entry of entries)
    for (const segment of entry.segments.filter((part) => !isParameter(part)))
      expect(segment, `${label(entry)}: используйте kebab-case`).toMatch(
        /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
      );
});

function isLegacyConnection(entry: Entry) {
  return (
    entry.resource === 'connections' &&
    entry.endpoint.path === legacy.connections.path &&
    legacy.connections.methods.some(
      (method) => method === entry.endpoint.method,
    )
  );
}

function unknownPathSegment({ segments }: Entry) {
  return segments.find(
    (segment, index) =>
      !isParameter(segment) &&
      !collections.has(segment) &&
      (isParameter(segments[index + 1] ?? '') ||
        !(singletons.has(segment) || actions.has(segment))),
  );
}

test('resource paths use the agreed collections and nouns', () => {
  for (const entry of entries) {
    if (isLegacyConnection(entry)) continue;
    const segment = unknownPathSegment(entry);
    if (segment !== undefined)
      throw new Error(
        `${label(entry)}: «${segment}» отсутствует в словаре, согласуйте ресурс во множественном числе, одиночный ресурс или действие`,
      );
  }
});
test('path parameters use camelCase resourceId or index', () => {
  for (const entry of entries)
    for (const parameter of entry.segments.filter(isParameter))
      expect(
        parameter,
        `${label(entry)}: назовите параметр :<resource>Id или :index`,
      ).toMatch(/^:(?:[a-z][a-zA-Z0-9]*Id|index)$/);
});

test('workspace prefix is required except for declared global reads', () => {
  for (const entry of entries)
    expect(
      entry.endpoint.path.startsWith('/workspaces/:workspaceId/') ||
        globals.has(address(entry.endpoint)),
      `${label(entry)}: добавьте префикс /workspaces/:workspaceId или обоснуйте глобальное чтение`,
    ).toBe(true);
});

test('path nesting fits within the deepest existing address', () => {
  for (const entry of entries)
    expect(
      entry.segments.length,
      `${label(entry)}: вынесите ресурс ближе к корню области`,
    ).toBeLessThanOrEqual(8);
});

function endsWithReadResource(entry: Entry) {
  const last = entry.segments.at(-1) ?? '';
  return !actions.has(last);
}

test('GET ends with a noun or an identifier', () => {
  for (const entry of entries.filter(
    ({ endpoint }) => endpoint.method === 'GET',
  )) {
    expect(
      endsWithReadResource(entry),
      `${label(entry)}: дайте читаемому ресурсу имя существительное`,
    ).toBe(true);
  }
});

test('actions use POST after an identifier and one verb', () => {
  for (const entry of entries) {
    for (const [index, segment] of entry.segments.entries()) {
      if (!actions.has(segment)) continue;
      expect(
        entry.endpoint.method === 'POST' &&
          isParameter(entry.segments[index - 1] ?? '') &&
          index === entry.segments.length - 1 &&
          /^[a-z]+$/.test(segment),
        `${label(entry)}: используйте POST …/:id/<глагол>, одно слово в конце`,
      ).toBe(true);
    }
  }
});

function endsWithCollectionOrAction(entry: Entry) {
  const last = entry.segments.at(-1) ?? '';
  return actions.has(last) || collections.has(last);
}

test('POST creates a collection member or invokes an action', () => {
  for (const entry of entries.filter(
    ({ endpoint }) => endpoint.method === 'POST',
  )) {
    if (
      address(entry.endpoint) === legacy.fields.address ||
      isLegacyConnection(entry)
    )
      continue;
    expect(
      endsWithCollectionOrAction(entry),
      `${label(entry)}: создавайте через POST в коллекцию, правьте через PATCH, заменяйте через PUT`,
    ).toBe(true);
  }
});

test('DELETE has no request body', () => {
  for (const entry of entries.filter(
    ({ endpoint }) => endpoint.method === 'DELETE',
  ))
    expect(
      entry.endpoint.body,
      `${label(entry)}: адресуйте удаляемый ресурс по пути без тела`,
    ).toBeUndefined();
});

test('operation names are unique and use verbResource camelCase', () => {
  const seen = new Map<string, Entry>();
  for (const entry of entries) {
    expect(
      entry.name,
      `${label(entry)}: назовите экспорт глаголом и ресурсом в camelCase`,
    ).toMatch(
      /^(?:get|list|create|upload|download|stream|save|revoke|delete|remove|retry|analyze|edit|confirm|generate)[A-Z][a-zA-Z0-9]*$/,
    );
    const previous = seen.get(entry.name);
    if (previous)
      throw new Error(
        `${label(previous)} и ${label(entry)}: дайте операциям разные имена (${previous.resource}, ${entry.resource})`,
      );
    seen.set(entry.name, entry);
  }
});

test('method and normalized path uniquely identify the operation', () => {
  const seen = new Map<string, Entry>();
  for (const entry of entries) {
    const key = `${entry.endpoint.method} /${entry.segments.map(normalize).join('/')}`;
    const previous = seen.get(key);
    if (previous)
      throw new Error(
        `${label(previous)} и ${label(entry)}: объедините описания с одинаковой формой пути`,
      );
    seen.set(key, entry);
  }
});

test('static segments do not shadow parameters at the same method and prefix', () => {
  for (const [left, right] of pairs()) {
    if (left.endpoint.method !== right.endpoint.method) continue;
    const index = left.segments.findIndex(
      (segment, position) =>
        normalize(segment) !== normalize(right.segments[position] ?? ''),
    );
    const other = right.segments[index];
    if (index < 0 || other === undefined) continue;
    if (isParameter(left.segments[index] ?? '') !== isParameter(other))
      throw new Error(
        `${label(left)} и ${label(right)}: статический сегмент пересекается с параметром, перенесите действие в query или в другую ветку`,
      );
  }
});

function resourceBranch(entry: Entry) {
  let index = entry.segments.length - 1;
  while (index >= 0 && !collections.has(entry.segments[index] ?? '')) index--;
  const resource = collections.get(entry.segments[index] ?? '');
  const branch = entry.segments.slice(0, index).map(normalize).join('/');
  const last = entry.segments.at(-1) ?? '';
  // Для коллекции канонизируем и последний сегмент, например recognitions и documents.
  const tail = collections.get(last) ?? normalize(last);
  return { resource, branch, tail };
}

function overlapReason(left: Entry, right: Entry) {
  const a = left.endpoint;
  const b = right.endpoint;
  if (a.method !== b.method) return;
  if (
    a.method === 'GET' &&
    a.response.kind === 'json' &&
    b.response.kind === 'json' &&
    a.response.schema === b.response.schema
  )
    return 'общая схема ответа GET';
  const first = resourceBranch(left);
  const second = resourceBranch(right);
  if (
    first.resource &&
    first.resource === second.resource &&
    first.tail === second.tail &&
    first.branch !== second.branch
  )
    return 'один ресурс и окончание пути в разных ветках';
}

test('semantic API overlaps are explicitly declared', () => {
  const found = new Set<(typeof declaredOverlaps)[number]>();
  for (const [left, right] of pairs()) {
    const reason = overlapReason(left, right);
    if (!reason) continue;
    const declaration = declaredOverlaps.find(
      ({ pair }) =>
        pair.some((name) => name === left.name) &&
        pair.some((name) => name === right.name),
    );
    if (!declaration)
      throw new Error(
        `${label(left)} и ${label(right)}: ${reason}. Расширь существующий endpoint или объяви пересечение с причиной в declaredOverlaps`,
      );
    expect(
      declaration.reason.trim(),
      `${label(left)} и ${label(right)}: объясните пересечение`,
    ).not.toBe('');
    found.add(declaration);
  }
  for (const declaration of declaredOverlaps)
    expect(
      found.has(declaration),
      `${declaration.pair.join(' и ')}: удалите устаревшую запись из declaredOverlaps`,
    ).toBe(true);
});

test('query uses at most one pagination mode', () => {
  for (const entry of entries) {
    const shape = entry.endpoint.query?.shape ?? {};
    expect(
      ('page' in shape || 'pageSize' in shape) &&
        ('after' in shape || 'limit' in shape),
      `${label(entry)}: выберите page/pageSize или after/limit`,
    ).toBe(false);
  }
});

function hasListItems(entry: Entry) {
  const { response } = entry.endpoint;
  return (
    response.kind === 'json' &&
    response.schema instanceof z.ZodObject &&
    'items' in response.schema.shape
  );
}

function listViolation(entry: Entry) {
  const { endpoint, name } = entry;
  if (endpoint.response.kind !== 'json') return;
  if (
    !hasListItems(entry) &&
    !(endpoint.method === 'GET' && name.startsWith('list'))
  )
    return;
  const mode = listResponseMode(endpoint.response.schema);
  if (!mode)
    return 'создайте ответ через pageResponseSchema или cursorResponseSchema';
  if (listQueryMode(endpoint.query) !== mode)
    return 'используйте общую схему query в том же режиме, что и ответ';
}

test('list responses use shared pagination schemas and matching query fields', () => {
  for (const entry of entries) {
    const exception = Object.entries(legacy.lists).find(
      ([name]) => name === entry.name,
    )?.[1];
    if (!hasListItems(entry) && exception?.address === address(entry.endpoint))
      continue;
    const violation = listViolation(entry);
    if (violation) throw new Error(`${label(entry)}: ${violation}`);
  }
});

test('legacy API exceptions still cover violations at their declared addresses', () => {
  const fields = entries.find(
    (entry) => address(entry.endpoint) === legacy.fields.address,
  );
  expect(
    fields !== undefined && !endsWithCollectionOrAction(fields),
    `${legacy.fields.address}: удалите устаревшую запись из legacy.fields`,
  ).toBe(true);

  for (const method of legacy.connections.methods) {
    const connection = entries.find(
      (entry) => isLegacyConnection(entry) && entry.endpoint.method === method,
    );
    expect(
      connection !== undefined &&
        (unknownPathSegment(connection) !== undefined ||
          (method === 'POST' && !endsWithCollectionOrAction(connection))),
      `${method} ${legacy.connections.path}: удалите устаревший метод из legacy.connections`,
    ).toBe(true);
  }

  for (const [name, exception] of Object.entries(legacy.lists)) {
    const list = entries.find(
      (entry) =>
        entry.name === name && address(entry.endpoint) === exception.address,
    );
    expect(
      list !== undefined &&
        !hasListItems(list) &&
        listViolation(list) !== undefined,
      `${name} (${exception.address}): удалите устаревшую запись из legacy.lists`,
    ).toBe(true);
  }
});
test('summaries describe each operation in one Russian line', () => {
  for (const entry of entries)
    expect(
      entry.endpoint.summary,
      `${label(entry)}: добавьте краткий русский summary в одну строку`,
    ).toMatch(/^[^\r\n\u2028\u2029]*[а-яё][^\r\n\u2028\u2029]*$/iu);
});
