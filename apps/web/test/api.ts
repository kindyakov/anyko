import { afterEach } from 'bun:test';

// Сеть и поток событий подменяются на уровне глобальных объектов: запрос проверяется по адресу,
// методу, ключу идемпотентности и телу так, как его получит API. После каждого теста подмены снимаются.
const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
  FakeEventSource.instances.length = 0;
});

export type Exchange = {
  method: string;
  url: string;
  idempotencyKey: string | null;
  body: unknown;
};

// Сетевая ошибка: fetch отклоняется, как при обрыве соединения.
export const networkError = 'network-error' as const;

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Ответ выбирает handler по запросу; список запросов сохраняет их в порядке отправки.
export function serveApi(
  handler: (
    exchange: Exchange,
  ) => Response | Promise<Response> | typeof networkError,
) {
  const exchanges: Exchange[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const exchange: Exchange = {
      method: init?.method ?? 'GET',
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      idempotencyKey: new Headers(init?.headers).get('idempotency-key'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    };
    exchanges.push(exchange);
    const answer = handler(exchange);
    return answer === networkError
      ? Promise.reject(new TypeError('fetch failed'))
      : Promise.resolve(answer);
  }) as typeof fetch;
  return exchanges;
}

// Поток событий: тест открывает его через installEventSource и присылает события вызовом emit.
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly #listeners = new Map<string, (event: MessageEvent) => void>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.#listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data?: object) {
    this.#listeners.get(type)?.(
      new MessageEvent(type, { data: JSON.stringify(data) }),
    );
  }
}

export function installEventSource(): FakeEventSource[] {
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
  return FakeEventSource.instances;
}
