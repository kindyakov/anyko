# apps/worker

Процесс Bun с очередями BullMQ. Он разбирает envelope задания, получает scope исполнения и вызывает обработчик из `@anyko/backend`. Сценарии, промпты агента и правила сведений живут в backend, а не здесь.

## Устройство

```text
src/index.ts             вызывает bootstrap
src/bootstrap/           start-worker, env, ресурсы, выбор WORKER_QUEUES, остановка;
                         единственное место импорта @anyko/backend/runtime (кроме cli/diagnostic.ts)
src/queues/              единственный хост BullMQ: регистрация JobDefinition, envelope, остановка
src/loops/               dispatcher outbox и reconciler через порты processing
src/cli/                 диагностические команды
tests/                   конфигурация процесса; tests/integration — с настоящим Redis
```

BullMQ и ioredis импортируются только в `queues` и `loops`. Backend о них не знает (`backend-no-queue-libs`).

## Как добавлять

- **Задание:** `defineJob` у владельца в backend, строка в `packages/backend/src/runtime/jobs.ts`, проверка устаревшей попытки. Worker подхватывает его из реестра, отдельный код здесь не нужен ([задания](../../docs/engineering/backend.md#задания)).
- **Переменная окружения или предел агента:** схема в `src/bootstrap/backend-config.ts` или `config.ts` с диапазоном и значением по умолчанию, проброс в `BackendConfig`, строка в `.env.example`, тест в `tests/config.test.ts` ([правила кода](../../docs/engineering/code-rules.md#ошибки-и-побочные-эффекты)).
- **Сценарий, которому нужны backend и хост очередей:** тест в корневом `tests/integration/worker`.

## Правила

[Серверная часть](../../docs/engineering/backend.md#задания), [доставка и исполнение](../../docs/engineering/data-and-jobs.md#доставка-и-исполнение), [очередь и журнал](../../docs/engineering/runtime-foundation.md#очередь), [выкат очередей](../../docs/engineering/operations.md#выкат-заданий-и-очередей). Конвейер работы и пределы агента — [work-pipeline.md](../../docs/engineering/work-pipeline.md).
