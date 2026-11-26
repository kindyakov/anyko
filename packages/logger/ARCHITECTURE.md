# packages/logger

Общий серверный формат событий на pino и безопасные поля для API, worker и backend. Модули передают идентификаторы операции и код ошибки, а не документ, тело запроса или секрет.

## Устройство

```text
src/index.ts             createLogger, LogEvent, LogLevel, Logger
src/diagnostics.ts       диагностические поля событий
```

## Как добавлять

- Новое поле события — часть общего формата: проверьте, что оно не несёт персональных данных, текста документа и ключей, и добавьте тест в `src/logger.test.ts`.
- Событие сбоя содержит `failure.code`, `failure.message`, `failure.operation`, `failure.source` и `correlationId`: по ним агент ищет причину в журнале.

## Правила

[События и серверный журнал](../../docs/engineering/runtime-foundation.md#события-и-серверный-журнал), [правила кода: ошибки](../../docs/engineering/code-rules.md#ошибки-и-побочные-эффекты).
