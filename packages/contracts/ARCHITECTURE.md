# packages/contracts

Безопасные для браузера HTTP-схемы Zod, DTO, endpoint-описания и события SSE. Источник типов для API и web. Зависит только от Zod; не знает backend, Prisma и секретов.

## Устройство

```text
src/common/              endpoint(), ID, пагинация, каталог кодов ошибок
src/<ресурс>/            session, works, documents, catalog, connections:
                         schemas.ts, endpoints.ts, events.ts (SSE)
```

Корневого экспорта нет: ресурс импортируется по subpath (`@anyko/contracts/works`). Новый ресурс добавляется в `exports` в `package.json`. Будущий `admin` — отдельный subpath, недоступный web (`web-no-contracts-admin`).

## Как добавлять

- **Endpoint:** описание в `src/<ресурс>/endpoints.ts` с методом, путём, схемами, `errors`, `summary` и полем `idempotency` для изменяющих методов. Маршрут — в `apps/api` ([рецепт](../../apps/api/ARCHITECTURE.md#как-добавлять)).
- **Код ошибки:** каталог `src/common/errors`, затем список `errors` нужных endpoint.
- HTTP-схема описывает формат обмена, а не таблицу БД и не доменную модель. Поля профиля БФЛ в контракт не перечисляются: каталог полей приходит в ответе.

## Правила

[Серверная часть: HTTP](../../docs/engineering/backend.md#http), [проектирование адресов](../../docs/engineering/backend.md#проектирование-адресов), [каталог API](../../docs/engineering/api-catalog.md).
