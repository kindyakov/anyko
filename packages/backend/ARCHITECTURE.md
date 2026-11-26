# packages/backend

Серверная предметная часть: модули-владельцы данных, сценарии нескольких владельцев, профиль БФЛ и единственная сборка для API и worker. Транспорт (HTTP, BullMQ) живёт в приложениях; backend не импортирует `@anyko/contracts`, BullMQ, ioredis и Elysia.

## Устройство

```text
src/modules/<name>/      владелец данных: index.ts (фасад и типы), module.ts (createXModule),
                         domain/, application/ (файл на команду или запрос), infrastructure/
src/workflows/<process>/ сценарии нескольких модулей через фасады и UnitOfWork
src/profiles/            предметные правила БФЛ и план анализа; без I/O, Prisma и env
src/platform/            ошибки, scope, ID, часы, транзакции, определения заданий, storage
src/runtime/             createBackend, BackendConfig, реестр заданий — composition root
tests/                   unit-тесты пакета и tests/integration на PostgreSQL
```

Агент работы (Mastra, инструменты чтения, пошаговая сессия, сверка, чат) — модуль `modules/agents`. Бланки и подготовка DOCX — `modules/templates` ([README бланков](src/modules/templates/assets/README.md)).

## Как добавлять

Таблица рецептов — [backend.md](../../docs/engineering/backend.md#как-добавлять): команда, сценарий, задание, модуль, интеграция, код ошибки. Дополнительно:

- **Unit-тест** лежит рядом с кодом и вписывается в команду из корневого `package.json` (`test:works` и соседние); без этого он не запускается.
- **Предел, таймаут или параллелизм** приходит через `BackendConfig` из env процесса, а не числом в коде ([правила кода](../../docs/engineering/code-rules.md#ошибки-и-побочные-эффекты)).
- **Промпт, инструмент агента или проверка кандидатов:** сначала класс ошибки по [правилу ответов модели](../../docs/engineering/code-rules.md#ответы-модели).
- **Новая версия бланка или пакета:** [README бланков](src/modules/templates/assets/README.md) и [ADR 0012](../../docs/adr/0012-processing-profiles-and-package-descriptions.md).

## Правила

[Серверная часть](../../docs/engineering/backend.md) — уровни, импорты, модуль, ошибки, задания, тесты. [Данные и задания](../../docs/engineering/data-and-jobs.md) — владение таблицами, транзакции, outbox. [Работы и модели](../../docs/engineering/work-pipeline.md) — конвейер анализа, агент, пределы, SSE. Границы проверяет `.dependency-cruiser.cjs`; новое межмодульное ребро добавляется туда и обсуждается на review.
