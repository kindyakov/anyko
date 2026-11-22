# packages/typescript-config

Общие `tsconfig` по средам: `base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `server.json` для Bun-процессов и backend, `next.json` для web, `library.json` для пакетов. Workspace наследует нужный файл и не повторяет его настройки.

## Как добавлять

- Новая настройка, общая для среды, добавляется сюда, а не в `tsconfig.json` отдельного workspace.
- Ослабление строгости — изменение правил с отдельным обоснованием на review.
- Версия TypeScript и ограничения его программного API описаны в [зависимостях](../../docs/engineering/dependencies.md).

## Правила

[Правила кода: типы](../../docs/engineering/code-rules.md#типы-и-границы-данных).
