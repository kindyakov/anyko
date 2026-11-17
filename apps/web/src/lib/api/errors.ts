// Проблема с конкретным полем запроса из `error.fields` ответа `invalid`; `path` — имя поля формы.
type ApiErrorField = { path: (string | number)[]; code: string };

export class ApiError extends Error {
  // `fields` есть только у ошибок с разбором полей; без них поле не задаётся вовсе.
  readonly fields?: readonly ApiErrorField[];

  constructor(
    readonly code: string,
    readonly status: number | undefined,
    readonly requestId: string | undefined,
    fields?: readonly ApiErrorField[],
  ) {
    super(code);
    this.name = 'ApiError';
    if (fields !== undefined) this.fields = fields;
  }
}

// Тексты ошибок feature. `codes` — таблица по кодам её endpoint. После этапа #11 (каталог кодов
// в contracts) ключи `codes` сузятся до кодов endpoint с проверкой `satisfies Record<Code, string>`.
// `technical` и `fallback` — общие тексты технических сбоев и прочих ошибок; служебные ключи
// не смешиваются с кодами API.
export type ApiErrorTexts = {
  codes?: Partial<Record<string, string>>;
  technical?: string;
  fallback?: string;
};

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Тексты кодов доступа и повтора одинаковы для всех команд: features включают их в свою таблицу `codes`.
export const sharedCodeTexts = {
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  IDEMPOTENCY_IN_PROGRESS:
    'Предыдущий запрос ещё выполняется. Подождите и повторите.',
  IDEMPOTENCY_CONFLICT:
    'Запрос уже отправлялся с другими данными. Повторите действие.',
} as const;

const technicalCodes = new Set([
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'REQUEST_ABORTED',
  'INVALID_RESPONSE',
  'HTTP_ERROR',
]);

const commonTechnicalText =
  'Не удалось получить ответ сервера. Повторите попытку позже.';
const commonFallbackText = 'Операция не выполнена. Повторите попытку.';

// Текст причины без номера обращения: номер добавляет вызывающий в собственном формате.
export function describeApiError(
  error: unknown,
  texts: ApiErrorTexts = {},
): string {
  if (!(error instanceof ApiError)) return texts.fallback ?? commonFallbackText;
  const own = texts.codes?.[error.code];
  if (own) return own;
  const technical =
    technicalCodes.has(error.code) ||
    (error.status !== undefined && error.status >= 500);
  if (technical) return texts.technical ?? commonTechnicalText;
  return texts.fallback ?? commonFallbackText;
}
