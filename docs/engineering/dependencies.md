# Версии и совместимость инструментов

Проверено 5 ноября 2026 по npm registry dist-tag latest и официальным выпускам.
Прямые зависимости закрепляются точными версиями; workspace использует один
lockfile. Обновления проходят полный контроль качества, включая интеграцию.

| Назначение                            | Версия                  |
| ------------------------------------- | ----------------------- |
| Bun                                   | 1.4.4                   |
| Node для инструментов, актуальный LTS | 26.13.0                 |
| TypeScript compiler (`tsc`)           | 7.0.2                   |
| Elysia / Next.js                      | 1.4.31 / 16.4.5         |
| React / React DOM                     | 19.3.1                  |
| Zod / Pino                            | 4.6.7 / 10.4.0          |
| BullMQ / ioredis / Redis              | 6.7.0 / 6.0.0 / 8.10.3  |
| ESLint / typescript-eslint            | 10.14.0 / 8.72.1        |
| Bun fmt / Knip / dependency-cruiser   | 1.4.4 / 6.44.1 / 18.7.2 |

## TypeScript 7 и программный API

TypeScript 7 является основным компилятором. Его CLI устанавливается через
`@typescript/native: npm:typescript@7.0.2` и предоставляет команду `tsc`.
Пакет под именем `typescript` — официальный compatibility API
`npm:@typescript/typescript6@6.0.2`, необходимый typescript-eslint и другим
потребителям прежнего JavaScript API. Он предоставляет отдельную команду
`tsc6`; стандартный typecheck использует `tsc` версии 7.

Это рекомендованная Microsoft схема
[параллельного использования](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
Версия 6.0.2 является latest именно compatibility-пакета на дату проверки.
Произвольные overrides и отключение типизированных ESLint-правил не нужны.
Next может использовать compatibility API для своей встроенной проверки;
самостоятельный workspace typecheck всегда выполняется компилятором 7.

Владелец настройки — инженерная основа Anyko. Удалить compatibility alias
после поддержки нового API всеми реальными потребителями и успешного
повторения typecheck, typed lint, проверки импортов, Knip и сборки. До этого
обновлять оба пакета осознанно; номер `typescript` в manifest сам по себе
не определяет версию команды `tsc`.

Node не обновляется глобально агентом. Выбранный LTS закреплён в `.node-version`
и CI; локальный инструментальный runtime может быть подготовлен отдельно.
Production приложения продолжают работать на Bun.
