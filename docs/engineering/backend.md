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
    routes/<resource>/      маршруты ресурса; перевод модели в контракт, если формы различаются
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
  workflows/<process>/      work-intake, work-review, work-generation, work-view (этап 5a)
    index.ts                фабрика процесса и тип, который использует HTTP
    <scenario>.ts           один сценарий процесса; общие проверки процесса — рядом (work-guards.ts)
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

| Откуда                       | Разрешено                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `api/bootstrap`              | `@anyko/backend/runtime`, `@anyko/logger`                                                                                             |
| `api/http`                   | `@anyko/contracts/*`, типы публичных фасадов `@anyko/backend/<module>`, Elysia                                                        |
| `api/http/realtime`          | ioredis только для подписки на временные потоки; без BullMQ                                                                           |
| `worker/bootstrap`           | `@anyko/backend/runtime`, `@anyko/logger`                                                                                             |
| `worker/queues`, `loops`     | BullMQ, ioredis, `JobDefinition` и фасад `processing` из runtime                                                                      |
| `backend/runtime`            | всё внутри `backend`, включая `modules/*/infrastructure` и `modules/*/module.ts` (фабрика фасада)                                     |
| `backend/workflows`          | `modules/*/index.ts` и `module.ts` (только тип фасада), `profiles`, `platform`; без `application`, `domain`, `infrastructure` модулей |
| `modules/<m>/application`    | свой `domain`, свои порты, `platform`, `modules/<n>/index.ts` по allowlist без цикла                                                  |
| `modules/<m>/domain`         | свои файлы, `platform/errors`, `platform/scope` (типы)                                                                                |
| `modules/<m>/infrastructure` | свои порты, `database`, `platform`, SDK интеграции                                                                                    |
| `profiles`                   | `platform/errors`; без I/O, Prisma, env, модулей и workflows                                                                          |
| `platform`                   | технические библиотеки; без модулей, профилей и workflows                                                                             |
| `backend` (любой файл)       | не импортирует `@anyko/contracts`, BullMQ, ioredis, Elysia                                                                            |
| `platform/scope` (выдача)    | конструкторы scope импортируют только `modules/access` и `modules/processing`                                                         |
| `contracts`                  | только Zod                                                                                                                            |

## Модуль

Фасад отделяет команды от запросов и даёт ту же поверхность внутри транзакции. Публичные типы и ошибки лежат в `index.ts`; фабрика `createXModule` — в `module.ts`, его собирает runtime. `index.ts` не импортирует `module.ts`, поэтому `application` берёт типы из `index.ts` без цикла. Хранилище внутри транзакции создаёт `storeFor(tx)` в `infrastructure`: токен `Tx` превращается в клиент драйвера только там (`transactionHandle`).

Текущий фасад `documents` не предоставляет `in(tx)`: его операции загрузки и удаления
сочетают внешнее хранилище, блокировки и собственные короткие транзакции. Нельзя
просто обернуть эти операции в транзакцию вызывающего. Если появится межмодульное
действие, которому нужна атомарная запись документов, выделите отдельную команду
только для записи в БД и предоставьте её через `in(tx)`, не помещая вызовы S3 в транзакцию.
Внешние вызовы модели доступны в `agents.model` и отсутствуют в `agents.in(tx)`.

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
  path: '/works/:workId/confirm',
  params: z.object({ workId: z.uuid() }),
  body: json(revisionSchema),
  response: json(workResponseSchema),
  status: 200,
  errors: [
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'REVISION_CONFLICT',
    'WORK_BUSY',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  // Повтор после подтверждения с той же ревизией не меняет сведения: REVISION_CONFLICT.
  idempotency: 'natural',
});

// apps/api/src/http/routes/works/index.ts
route(app, confirmWork, ({ scope, params, body }) =>
  works.confirm(scope, { ...body, workId: brandWorkId(params.workId) }),
);
```

`endpoint()` принимает `json(schema)` или `multipart({ поле: схема })` как тело, `json`, `fileDownload()` или `eventStream()` как ответ. Поле `invalid` обязательно, если есть любой вход (`params`, `query`, `headers`, тело), и указывает код ошибки входа; `invalidHeaders` задаёт код для заголовков, если он отличается. Поле `idempotency` обязательно у POST, PUT, PATCH и DELETE и запрещено у GET. Значение `key` — команда повторяется по `Idempotency-Key`: заголовок, его код ошибки и коды `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS` контракт добавляет и проверяет сам (ответ должен быть `json`). `natural` — повтор безопасен по смыслу операции (удаление, правка или подтверждение с ревизией, сохранение настроек). `none` — повтор не проверен, ключа нет. Код ошибки вне `errors` не компилируется. Раздел «Повтор команд» ниже описывает поведение.

`route()` проверяет заголовки, параметры, query и тело через Standard Schema в порядке, который задаёт описание, и отклоняет неверный вход кодом `invalid` без вызова обработчика. Область из адреса проверяет plugin `workspace-scope` до разбора входа: чужая или несуществующая область даёт 404 без чтения тела. Права проверяет сценарий, маршрут их не знает. Ответ `json` проверяется схемой `response`: при нарушении ответ становится `INTERNAL_ERROR` и пишется `http_response_invalid`. Ответ `file` получает `cache-control: no-store` и `x-content-type-options: nosniff`; обработчик задаёт остальные заголовки. Код `AppError` вне `errors` в `NODE_ENV=test` даёт 500 и событие `http_undeclared_error_code`; в остальных средах ответ прежний, событие пишется. Тест по реестру проверяет, что каждое описание зарегистрировано ровно один раз под `/api/v1`, и что под `/api/` вне `/api/v1/` и `/api/auth/` маршрутов нет: иначе адрес обошёл бы проверку области. Режим `key` выполняется через модуль `idempotency` после разбора входа и проверки области; подробности — в разделе «Повтор команд».

### Область и права

`WorkspaceScope` (`platform/scope`) — брендированный тип с `userId`, `workspaceId`, `rights`, методами `has(right)` и `require(right)`. `require` бросает `AppError` вида `forbidden` с кодом `FORBIDDEN`. Создаёт область только `modules/access`: `scopeFor(session, workspaceId)` выдаёт её для участия из сессии, иначе `null`. Файл выдачи `platform/scope/issue.ts` импортирует только `access` (правило `backend-scope-issued-by-access`).

Права — каталог `rightCatalog` в `platform/scope/rights.ts`; роли задают наборы в `modules/access/domain/roles.ts`: owner — все, member — все, кроме `connections.manage` и `members.invite`. Каталог совпадает с `rightSchema` в `contracts/session`: тест `apps/api/tests/rights-catalog.test.ts` сверяет оба списка. Сценарии проверяют право первым действием: `works.create`, `works.edit`, `works.generate`, `documents.upload`, `documents.delete`, `recognitions.use`, `connections.read`, `connections.manage`. Внутренние операции сервисов права не проверяют: их вызывает сценарий, который уже проверил право.

Идентификаторы — `platform/ids.ts`: `parseWorkspaceId` и `parseUserId` возвращают `null` для непроверенного входа; `brandWorkId`, `brandDocumentId`, `brandGenerationId`, `brandFileId` проверяют UUID схемой contracts и бросают ошибку при несовпадении (это ошибка контракта, не ответ клиенту). `uuidV7` — генератор для новых ID; сценарии переходят на него в этапах #19 и #4b.

Отдельный слой presenters не вводится. Backend не импортирует `contracts` и описывает свои модели сам (`modules/*/schemas.ts`, `profiles/bfl`); маршрут возвращает модель, если её форма совпадает с контрактом, и переводит её в маршруте, если нет. Совместимость проверяют тип ответа `route()` при компиляции и схема ответа описания во время выполнения (`http_response_invalid`). Ошибки полей тела строит `fieldErrors` из `@anyko/backend/errors`: им пользуются и разбор тела в `route()`, и проверки профиля в сценариях. OpenAPI строится из тех же описаний и доступен вне production по `/api/v1/openapi.json`.

## Подключение модели

`modules/connections` владеет настройками `LlmSettings`, шифрованием ключа и ревизиями. `commands.save` и `commands.revoke` требуют `connections.manage`, `queries.current` требует `connections.read`. `in(tx)` связывает команды и аудит с одной транзакцией. Старт анализа выбирает только подключение области и сохраняет `settingsRevision`; при его отсутствии ответ содержит `LLM_NOT_CONFIGURED`. Генерация сохраняет ревизию при наличии подключения. Платформенный уровень отложен.

При ротации новая ревизия становится текущей, а запущенный анализ продолжает работать на своей. `DELETE /api/v1/workspaces/:workspaceId/settings/llm` отзывает все действующие ревизии области, стирает их зашифрованные ключи и пишет `connections.revoked` с номером последней ревизии и числом отозванных. Повторный отзыв без сохранения новых настроек не добавляет событий. `GET` после отзыва возвращает `settings: null`. Перед каждым шагом модели проверяется сохранённая ревизия. Отозванная ревизия завершает анализ с `CONNECTION_REVOKED` без перехода на другую. Уже отправленный запрос к провайдеру может завершиться. Исторический запуск с `settingsRevision: null` при первом чтении фиксирует актуальную на тот момент ревизию для этой попытки исполнения.

## Задания

BullMQ и ioredis размещаются только в `apps/worker/src/queues`. `platform/jobs` определяет типы и единственную функцию `parseJobEnvelope`; сценарии объявляют `defineJob` у владельца в `jobs.ts`. Явный список и расписания находятся в `runtime/jobs.ts`; новый вид задания не копирует хост очередей.

```ts
// workflows/work-analysis/jobs.ts: зависимости замыкаются при сборке.
defineJob({
  kind: 'run',
  name: 'work.analysis',
  version: 1,
  queue: 'llm',
  payload: z.object({}).strict(),
  timeoutMs: 1_500_000,
  retry: { attempts: 1, backoffMs: 0 },
  handler: (scope, _payload, signal) => execute(scope, signal),
});
```

Payload выводится из схемы. `kind: 'run'` получает `ExecutionScope`, выданный только `processing` по сохранённому запуску. Новый envelope: `{ envelopeVersion: 1, version: 1, workspaceId, runId, correlationId, attemptId?, payload }`. `version` — версия задания; `envelopeVersion` — версия контейнера. Проверяются версия, вид запуска, область, correlation ID и переданный attempt ID. Неизвестная версия, чужой или уже захваченный запуск и устаревшая попытка не вызывают обработчик. Захват и публикация результата по `attemptToken` остаются в механизме processing; scope не заменяет этот барьер.

`kind: 'scheduled'` разрешён только для `maintenance`. Обработчик получает системный контекст `{ clock, logger, signal, correlationId }`, без `WorkspaceScope` и `ExecutionScope`; он не может выдавать scope области. Envelope содержит `{ envelopeVersion: 1, version, correlationId, payload }` и проходит тот же parser. Глобальная работа вызывается через внутренние порты модулей, без фиктивной области или запуска. Каждому заданию соответствует расписание в реестре; фиксированный ключ BullMQ scheduler дедуплицирует расписание между репликами. Обработчики безопасны при повторе, выполняют ограниченные пакеты; BullMQ удерживает аренду одного срабатывания, а повтор после сбоя не гарантирует exactly-once побочные эффекты.

| Очередь       | Задания                                                           |
| ------------- | ----------------------------------------------------------------- |
| `ocr`         | `document.ocr`                                                    |
| `llm`         | `work.analysis`                                                   |
| `render`      | `work.generation`                                                 |
| `maintenance` | `work.maintenance`, `document.maintenance`, `idempotency.cleanup` |

Техническая диагностика — явное исключение: `diagnostic.ping` использует отдельную `QUEUE_NAME` (по умолчанию `anyko-diagnostic`), собственный версионированный envelope и работает в `mode=empty` без БД, области и сохранённого запуска. `WORKER_QUEUES` её не отключает. Клиент и хост диагностики тоже находятся в `apps/worker/src/queues`; CLI, readiness и portable smoke сохраняют поведение.

`WorkerBackend.jobs` предоставляет реестр, внутренние порты доставки и восстановления, часы и ID; `startJobWorker` экспортируется из `@anyko/worker/queues`. Dispatcher outbox и reconciler находятся в `apps/worker/src/loops` и не владеют правилами состояния. Redis не заменяет durable intent в PostgreSQL.

## Повтор команд и журнал действий

Команды режима `key` (создание работы, загрузка документа в работу, анализ, генерация, загрузка распознавания) принимают `Idempotency-Key` — UUID, который web создаёт на одно намеренное действие и переиспользует при автоматическом повторе. Порядок в `route()`: сессия → origin → область → разбор входа, включая заголовок → отпечаток → захват → сценарий → сохранение ответа.

- Ключ действует в пределах тройки «область, команда, ключ». Команда — `METHOD путь` из описания.
- Отпечаток — SHA-256 канонической формы params, query и body: порядок полей не важен. Файл входит именем и SHA-256 содержимого; значения полей в хранилище не попадают.
- Тот же ключ и тот же вход возвращают сохранённые статус и тело, сценарий не запускается. Тот же ключ с другим входом — `409 IDEMPOTENCY_CONFLICT`. Тот же ключ, пока первый запрос выполняется, — `409 IDEMPOTENCY_IN_PROGRESS`. Ошибка сценария снимает захват: повтор выполняется заново.
- Результат хранится 24 часа; просроченная запись считается отсутствующей. Захват без результата (процесс упал между выполнением и записью) перехватывается через 5 минут. Тогда повтор может выполнить сценарий ещё раз: это принятое ограничение до транзакционной записи результата вместе с действием. Очистка просроченных записей выполняется заданием `idempotency.cleanup` раз в минуту, максимум 20 пакетов по 100 строк; активный захват сохраняется.

Журнал действий (`modules/audit`): `record(tx, событие)` пишет строку в той же транзакции, что и действие. Сбой записи откатывает действие; откат действия отменяет событие. Перечень действий закрыт в `modules/audit/domain/events.ts`:

| Действие                     | Когда                                                   | Данные               |
| ---------------------------- | ------------------------------------------------------- | -------------------- |
| `access.membership_granted`  | выдача участия (`provisionLocalAccess`), инициатор пуст | роль                 |
| `connections.settings_saved` | сохранение настроек модели (и операторская команда)     | номер ревизии        |
| `documents.deleted`          | удаление документа распознавания или работы             | —                    |
| `generation.started`         | постановка генерации                                    | идентификатор работы |

Ключи API, содержимое документов и значения полей в журнал не попадают: данные события задаёт тип, а не произвольный объект. Обход через `in(tx)` всех модулей — отдельный этап #19.

## Как добавлять

| Изменение                      | Место и обязательная граница                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Новый endpoint                 | описание в `contracts/<resource>/endpoints.ts`, маршрут (и перевод модели, если формы различаются) в `api/http/routes/<resource>`, HTTP-тест      |
| Новая команда/запрос           | файл в `modules/<m>/application`, подключение в `module.ts`, право в `platform/scope`, unit или интеграционный тест                               |
| Сценарий нескольких владельцев | `workflows/<process>`, вызовы `module.in(tx)` внутри `UnitOfWork`, интеграционный тест на PostgreSQL                                              |
| Новое задание                  | `defineJob(kind: run)` у владельца, строка реестра и проверка устаревшей попытки; для `scheduled` — maintenance, расписание и тест повтора/версии |
| Новый модуль                   | `modules/<name>` с `index.ts` и `module.ts`, строка в `.dependency-cruiser.cjs`, сборка в `create-backend.ts`                                     |
| Новая интеграция               | `infrastructure` владельца с timeout и лимитом параллелизма; секция конфигурации в `BackendConfig`                                                |
| Новый код ошибки               | `defineErrors` модуля, каталог `contracts/common/errors`, список `errors` нужных endpoint                                                         |
| Операторская функция           | `routes/admin`, `contracts/admin`, `OperatorScope`; бизнес-правила остаются в модуле                                                              |

## Как проверяются правила

Принципы — в [quality.md](quality.md#как-проектировать-проверку-правила). Все проверки ниже выражены через соглашения, и новая функция по шаблону проходит их без правки проверок.

| Механизм                   | Правила                                                                                                                                                                                                                                                                                                                                                                                                              | Этап    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Типы                       | брендированные scope и ID в сигнатурах хранилищ; ответ обработчика по `response` endpoint; `satisfies Record<ErrorKind, number>`; payload `defineJob`                                                                                                                                                                                                                                                                | 1, 3, 4 |
| dependency-cruiser         | backend без `contracts`/BullMQ/ioredis/Elysia; `platform` без модулей; конструкторы scope только в `access`/`processing` (`backend-execution-scope-issued-by-processing`); нулевые импорты очередей (`backend-no-queue-libs`); `runtime` только в bootstrap; рёбра модулей; процессы через `index.ts`/`module.ts` (`backend-workflows-use-module-facades`); `Tx` без Prisma-значений (`backend-transactions-opaque`) | 1       |
| ESLint по папкам           | в `http/routes` нет `request.json()`, `formData()`, ручного разбора ID; в `domain`/`application` нет `new Date()`, `Date.now()`, `crypto.randomUUID()`, `process.env`                                                                                                                                                                                                                                                | 1       |
| Тест по реестру endpoint   | каждое описание зарегистрировано ровно один раз; возвращаемые коды входят в `errors`; каталог кодов совпадает с `defineErrors` модулей                                                                                                                                                                                                                                                                               | 3       |
| Обязательное поле описания | у POST/PUT/PATCH/DELETE поле `idempotency` (`key`, `natural`, `none`) обязательно по типу: решение принимается там, где объявлен endpoint                                                                                                                                                                                                                                                                            | 3       |
| Тест изоляции по реестру   | каждый endpoint с `:workspaceId` с чужой областью и случайными UUID → 404, без сессии → 401                                                                                                                                                                                                                                                                                                                          | 4       |
| Review                     | владелец сценария, узость портов, отсутствие внешних вызовов в `UnitOfWork`, ожидаемые ошибки через `defineErrors` (технический `throw new Error` законен), имена                                                                                                                                                                                                                                                    | —       |

Тест изоляции не требует данных под каждый endpoint: plugin scope выполняется до разбора тела и до поиска ресурса, поэтому чужая область отклоняется при любом теле. Этот порядок plugins — часть контракта `route()`.

Рёбра между модулями в `.dependency-cruiser.cjs` — единственный перечень, который меняется вместе с функциями. Это намеренно: новое межмодульное ребро обсуждается на review.

## Тесты

Unit-тесты домена и сценариев лежат рядом с кодом и подменяют порты простыми объектами. Интеграционные тесты модуля (`modules/<m>/tests`) работают с PostgreSQL и проверяют scope, уникальности и конкурентные редакции, включая отрицательные проверки чужой области. HTTP-тесты собирают приложение с реальным `createBackend` и проверяют статусы, коды и схемы ответов по endpoint-описаниям. Задания проверяются через обработчик и устаревшие попытки, без BullMQ, кроме отдельной проверки `worker/queues`.
