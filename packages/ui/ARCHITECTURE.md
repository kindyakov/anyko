# packages/ui

Примитивы интерфейса Anyko, токены и элементы бренда на React, Base UI и Tailwind. Компоненты не знают о работах, документах и API: предметный смысл остаётся в feature web. Без `@anyko/contracts`, `apps/` и Next (`ui-no-business`).

## Устройство

```text
src/index.ts             общие примитивы: кнопка, поля, выбор, модальное окно, подтверждение, статус, toast
src/form/                формы на TanStack Form (@anyko/ui/form)
src/chat/                элементы чата (@anyko/ui/chat)
src/brand/               фоновая графика и логотип (@anyko/ui/brand); остальной код её не импортирует (`ui-brand-isolated`)
src/styles.css           семантические токены Tailwind
```

## Как добавлять

- Новый примитив сначала ищется среди Base UI и существующих компонентов; поведение полей, выбора, вкладок и окон берётся из Base UI, а не пишется на нативных элементах.
- Оформление — Tailwind и семантические токены [брендбука](../../docs/brand/brandbook.md); у элементов с действием `cursor-pointer`, у отключённых — `cursor-not-allowed`.
- Компонент экспортируется через `src/index.ts` или subpath из `exports` в `package.json`.
- Компонентные тесты пишутся в feature web, которая использует примитив ([тестирование web](../../docs/engineering/web.md#тестирование)).

## Правила

[Web: UI](../../docs/engineering/web.md#ui), [интерфейс web](../../apps/web/ARCHITECTURE.md#интерфейс).
