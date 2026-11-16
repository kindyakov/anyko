<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Архитектура

Перед изменением маршрута, feature, запроса или общего компонента прочитайте [web.md](../../docs/engineering/web.md): уровни `app` → `features` → `@anyko/ui`/`lib`, импорт чужой feature только через `index.ts`, рабочая область в адресе `/w/[workspace]`, серверное состояние только через TanStack Query с фабрикой ключей, 401 и тексты ошибок — в `lib/api`. Там же рецепты добавления раздела, feature, запроса и команды.

## Интерфейс

- Внутренние импорты из `src` пишите через `@/`; соответствие задаёт `tsconfig.json`.
- Оформление компонентов — Tailwind CSS. `globals.css` содержит подключение Tailwind и семантические токены из [брендбука](../../docs/brand/brandbook.md). Используйте `bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`; основной акцент — `brand`.
- Интерфейс использует постоянную тёмную тему, заданную в корневом layout, независимо от настроек системы. Новые экраны проверяйте на настольной и узкой ширине. Шрифты бренда подключены локально.
- Все элементы с действием показывают `cursor-pointer`; отключённые — `cursor-not-allowed`. Общий Tailwind base layer в `globals.css` покрывает семантические элементы и интерактивные ARIA-роли.
- Интерактивные примитивы — Base UI; общие элементы находятся в `@anyko/ui` (до переноса пакета — в `src/components/ui`). Перед добавлением зависимости используйте существующий примитив. 21st.dev — источник образцов компонентов; при переносе кода проверяйте лицензию и фиксируйте происхождение.
- Серверное состояние — TanStack Query; запросы проходят через `requestApi` с проверкой схемы ответа, ключи и `queryOptions` лежат в `api/` своей feature. Zustand хранит клиентские настройки интерфейса, а локальная форма — собственный черновик. Серверные данные и секреты в persisted store не помещаются.
- Предпросмотр юридического документа сохраняет типографику исходного шаблона и белую бумагу. Динамические размеры из OOXML и измеренная высота textarea являются данными документа; для них допустимы inline styles, остальное оформление — Tailwind.

- Для полей, форм, выбора, вкладок, переключателей, раскрывающихся секций и модальных окон используйте соответствующие Base UI primitives. Не создавайте их поведение на нативных `select`, `details`, `dialog` или вручную через ARIA. Семантическая разметка (`main`, `section`, заголовки, ссылки Next.js) остаётся HTML; многострочный ввод компонуется через `Field.Control render={<textarea />}`.
