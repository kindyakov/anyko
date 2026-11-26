# apps/api

HTTP-адаптер Elysia на Bun. Он проверяет вход, получает доверенный scope, вызывает сценарий `@anyko/backend` и переводит результат в ответ по endpoint-описанию `@anyko/contracts`. Предметных правил, SQL и сборки DOCX здесь нет.

## Устройство

```text
src/index.ts             вызывает bootstrap
src/bootstrap/           start-api, разбор env в BackendConfig; единственное место импорта @anyko/backend/runtime
src/http/app.ts          сборка приложения: plugins, группы маршрутов, health
src/http/route.ts        регистрация маршрута из endpoint-описания
src/http/plugins/        request-context, errors, session, workspace-scope, origin, idempotency, no-store
src/http/routes/<ресурс>/ маршруты ресурса; перевод модели в контракт, если формы различаются
tests/                   HTTP- и реестровые тесты (bun test tests)
```

## Как добавлять

- **Endpoint:** сначала [каталог API](../../docs/engineering/api-catalog.md) и [проектирование адресов](../../docs/engineering/backend.md#проектирование-адресов). Затем описание в `packages/contracts/src/<ресурс>/endpoints.ts`, маршрут в `src/http/routes/<ресурс>`, HTTP-тест, `bun run api:catalog` и раздел «Пересечения API» в отчёте ([процесс автора](../../docs/engineering/agent-workflow.md)).
- **Код ошибки:** `defineErrors` модуля, каталог `contracts/common/errors`, список `errors` endpoint ([ошибки](../../docs/engineering/backend.md#ошибки)).
- **Переменная окружения:** схема в `src/bootstrap`, секция `BackendConfig`, строка в `.env.example`.

Реестровые тесты (`api-design`, `isolation`, `registry`, `error-catalog`, `rights-catalog`) перебирают все endpoint сами. Новый endpoint, сделанный по образцу, проходит их без правки тестов.

## Правила

[Серверная часть](../../docs/engineering/backend.md): разделы «Уровни и импорты», «HTTP», «Область и права», «Повтор команд и журнал действий». Транзакции и доступ — [данные и задания](../../docs/engineering/data-and-jobs.md). Запуск, конфигурация и журнал — [runtime](../../docs/engineering/runtime-foundation.md).
