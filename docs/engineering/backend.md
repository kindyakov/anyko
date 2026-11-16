# Серверная часть

Правила `apps/api`, `apps/worker`, `packages/backend` и `packages/contracts`. Причины решений — [ADR 0004](../adr/0004-code-organization.md) и [ADR 0009](../adr/0009-backend-architecture.md). Данные, транзакции и доставка заданий — [data-and-jobs.md](data-and-jobs.md); типы и ошибки в целом — [code-rules.md](code-rules.md).

Это целевая структура. Директории появляются вместе с работающим кодом; пустые папки ради шаблона не создаются. Пока идёт переход, новое поведение пишется только в целевом виде.

## Структура

```text
apps/api/src/
  index.ts
  bootstrap/                start-api, разбор env в секции BackendConfig
  http/
    app.ts                  сборка Elysia: plugins, группы маршрутов, health
    route.ts                регистрация маршрута из endpoint-описания contracts
    plugins/                request-context, errors, session, workspace-scope,
                            origin, idempotency, no-store
    routes/<resource>/      маршруты ресурса и presenters «модель → контракт»
    routes/admin/           будущие операторские маршруты с OperatorScope
apps/worker/src/
  index.ts
  bootstrap/                start-worker, env, выбор WORKER_QUEUES
  queues/                   BullMQ: регистрация JobDefinition, envelope, остановка
  loops/                    dispatcher outbox и reconciler поверх processing
  health/                   live/ready
  cli/                      диагностические команды
packages/backend/src/
  platform/
    errors/                 AppError, виды ошибок, defineErrors
    scope/                  WorkspaceScope, ExecutionScope, OperatorScope, права
    transactions/           UnitOfWork и непрозрачный Transaction
    jobs/                   defineJob, envelope, классы очередей (без BullMQ)
    ids.ts                  брендированные ID, UUIDv7-генератор
    clock.ts                часы, передаваемые явно
    realtime.ts             порт временных потоков (публикация/подписка)
    storage/                S3-клиент с timeout и ограничением параллелизма
  modules/<name>/
    index.ts                публичный фасад: типы, коды ошибок, тип модуля
    module.ts               createXModule(deps): commands, queries, in(tx)
    domain/                 чистые правила и переходы состояний
    application/            один файл на команду или запрос; ports.ts
    infrastructure/         Prisma-хранилища и внешние адаптеры
    tests/                  интеграционные проверки модуля
  profiles/bfl/             поля, правила значений, схемы извлечения БФЛ
  workflows/<process>/
    index.ts                публичные команды и запросы процесса
    jobs.ts                 JobDefinition процесса
  runtime/
    create-backend.ts       composition root
    config.ts               BackendConfig
    jobs.ts                 явный реестр заданий
packages/contracts/src/
  common/                   endpoint(), ids, pagination, errors (каталог кодов)
  session/  works/  documents/  catalog/  connections/
                            schemas.ts, endpoints.ts, events.ts (SSE)
  admin/                    отдельный subpath, недоступный пользовательскому web
```

## Уровни и импорты

| Откуда                       | Разрешено                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `api/bootstrap`              | `@anyko/backend/runtime`, `@anyko/logger`                                            |
| `api/http`                   | `@anyko/contracts/*`, типы публичных фасадов `@anyko/backend/<module>`, Elysia       |
| `api/http/realtime`          | ioredis только для подписки на временные потоки; без BullMQ                          |
| `worker/bootstrap`           | `@anyko/backend/runtime`, `@anyko/logger`                                            |
| `worker/queues`, `loops`     | BullMQ, ioredis, `JobDefinition` и фасад `processing` из runtime                     |
| `backend/runtime`            | всё внутри `backend`, включая `modules/*/infrastructure`                             |
| `backend/workflows`          | `modules/*/index.ts`, `profiles`, `platform`                                         |
| `modules/<m>/application`    | свой `domain`, свои порты, `platform`, `modules/<n>/index.ts` по allowlist без цикла |
| `modules/<m>/domain`         | свои файлы, `platform/errors`, `platform/scope` (типы)                               |
| `modules/<m>/infrastructure` | свои порты, `database`, `platform`, SDK интеграции                                   |
| `profiles`                   | `platform/errors`; без I/O, Prisma, env, модулей и workflows                         |
| `platform`                   | технические библиотеки; без модулей, профилей и workflows                            |
| `backend` (любой файл)       | не импортирует `@anyko/contracts`, BullMQ, ioredis, Elysia                           |
| `platform/scope` (выдача)    | конструкторы scope импортируют только `modules/access` и `modules/processing`        |
| `contracts`                  | только Zod                                                                           |

## Модуль

Фасад отделяет команды от запросов и даёт ту же поверхность внутри транзакции:

```ts
// modules/works/module.ts
export function createWorksModule(deps: WorksDeps): WorksModule {
  const bind = (store: WorkStore) => ({
    commands: {
      create: createWork({ ...deps, store }),
      rename: renameWork({ ...deps, store }),
    },
    queries: { list: listWorks({ store }), get: getWork({ store }) },
  });
  return { ...bind(deps.store), in: (tx) => bind(deps.storeFor(tx)) };
}

// modules/works/application/rename-work.ts
export const renameWork =
  (deps: { store: WorkStore; clock: Clock }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; title: string; revision: number },
  ) => {
    scope.require('works.edit');
    const work = await deps.store.get(scope.workspaceId, input.workId);
    if (!work) throw WorkErrors.create('WORK_NOT_FOUND');
    if (work.revision !== input.revision)
      throw WorkErrors.create('REVISION_CONFLICT');
    return deps.store.rename(
      scope.workspaceId,
      input.workId,
      input.title,
      deps.clock.now(),
    );
  };
```

Сценарий проверяет право через scope, получает часы и ID явно, возвращает тип модуля. Хранилище требует `workspaceId` в каждом методе; поиск только по ID не является портом. Workflow, меняющий нескольких владельцев:

```ts
await uow.run(async (tx) => {
  const work = await works.in(tx).commands.create(scope, input);
  await agents.in(tx).commands.ensureSession(scope, { workId: work.id });
});
```

Внутри `uow.run` нет обращений к S3, Redis, OCR и LLM: callback может повториться.

## Ошибки

```ts
// modules/works/errors.ts, экспортируется из index.ts
export const WorkErrors = defineErrors({
  WORK_NOT_FOUND: 'not_found',
  REVISION_CONFLICT: 'conflict',
  WORK_BUSY: 'conflict',
  CLEANUP_PENDING: 'precondition',
});
```

| Вид               | HTTP | Значение                                               |
| ----------------- | ---- | ------------------------------------------------------ |
| `invalid`         | 400  | вход не прошёл предметную проверку                     |
| `unauthenticated` | 401  | нет действующей сессии                                 |
| `forbidden`       | 403  | нет права; для чужого ресурса используется `not_found` |
| `not_found`       | 404  | ресурса нет в доверенном scope                         |
| `conflict`        | 409  | редакция или состояние изменились                      |
| `precondition`    | 409  | действие пока недоступно: не готово, идёт очистка      |
| `unavailable`     | 503  | временный отказ зависимости; клиент может повторить    |

Формат ответа: `{ error: { code, requestId, fields? } }`. Ошибка вида `invalid` может нести `fields: { path: string; code: string }[]`, где `path` — ключ поля из каталога или путь в теле запроса. Тексты сообщений выбирает web по кодам, сервер их не отдаёт.

Код, достижимый через HTTP, присутствует в каталоге `contracts/common/errors` и в списке `errors` endpoint-описания. Неизвестное исключение становится `INTERNAL_ERROR` с записью в журнал.

## HTTP

```ts
// contracts/src/works/endpoints.ts
export const confirmWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/confirm',
  params: workParamsSchema,
  body: revisionSchema,
  response: workViewSchema,
  errors: ['WORK_NOT_FOUND', 'REVISION_CONFLICT', 'WORK_BUSY'],
});

// apps/api/src/http/routes/works/index.ts
route(confirmWork, async ({ scope, params, body }, { workView, facts }) => {
  await facts.commands.confirm(scope, {
    workId: params.workId,
    revision: body.revision,
  });
  return presentWorkView(await workView.queries.get(scope, params.workId));
});
```

`route()` подставляет схемы в Elysia через Standard Schema, требует `scope` для путей с `:workspaceId`, проверяет ответ схемой и отклоняет код ошибки вне списка endpoint в тестах. Presenter — чистая функция в папке ресурса. Маршрут не содержит SQL, проверки ролей и предметных ветвлений. Файлы и SSE описываются видом ответа `file` и `events` с отдельной схемой событий.

## Задания

```ts
// workflows/work-analysis/jobs.ts
export const analyzeWorkJob = defineJob({
  name: 'work.analyze',
  version: 1,
  queue: 'llm',
  payload: z.object({ runId: z.uuid() }).strict(),
  timeoutMs: 15 * 60_000,
  handler: (ctx, payload) =>
    ctx.deps.analysis.execute(ctx.scope, payload.runId, ctx.signal),
});
```

Envelope с версией, IDs и correlation ID разбирает `worker/queues`; неизвестная версия или несовпадение с сохранённым запуском отклоняется без исполнения. Обработчик получает `ExecutionScope` из `processing`, а не из payload. Расписание обслуживающих заданий объявляется в том же реестре.

## Как добавлять

| Изменение                      | Место и обязательная граница                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Новый endpoint                 | описание в `contracts/<resource>/endpoints.ts`, маршрут и presenter в `api/http/routes/<resource>`, HTTP-тест       |
| Новая команда/запрос           | файл в `modules/<m>/application`, подключение в `module.ts`, право в `platform/scope`, unit или интеграционный тест |
| Сценарий нескольких владельцев | `workflows/<process>`, вызовы `module.in(tx)` внутри `UnitOfWork`, интеграционный тест на PostgreSQL                |
| Новое задание                  | `defineJob` у владельца процесса, строка в `runtime/jobs.ts`, проверка устаревшей попытки                           |
| Новый модуль                   | `modules/<name>` с `index.ts` и `module.ts`, строка в `.dependency-cruiser.cjs`, сборка в `create-backend.ts`       |
| Новая интеграция               | `infrastructure` владельца с timeout и лимитом параллелизма; секция конфигурации в `BackendConfig`                  |
| Новый код ошибки               | `defineErrors` модуля, каталог `contracts/common/errors`, список `errors` нужных endpoint                           |
| Операторская функция           | `routes/admin`, `contracts/admin`, `OperatorScope`; бизнес-правила остаются в модуле                                |

## Тесты

Unit-тесты домена и сценариев лежат рядом с кодом и подменяют порты простыми объектами. Интеграционные тесты модуля (`modules/<m>/tests`) работают с PostgreSQL и проверяют scope, уникальности и конкурентные редакции, включая отрицательные проверки чужой области. HTTP-тесты собирают приложение с реальным `createBackend` и проверяют статусы, коды и схемы ответов по endpoint-описаниям. Задания проверяются через обработчик и устаревшие попытки, без BullMQ, кроме отдельной проверки `worker/queues`.
