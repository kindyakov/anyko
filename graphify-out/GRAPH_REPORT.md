# Graph Report - anyko  (2026-11-05)

## Corpus Check
- 153 files · ~70,133 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 6, .example 4, .pb 3)

## Summary
- 966 nodes · 1347 edges · 70 communities (59 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a461fc80`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- agent-github.mjs
- Anyko — брендбук
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- Примеры v1
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- Agent skills
- logger/src/index.ts
- engineering/README.md
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- prettier-config/package.json
- architecture.js
- exports
- web/tsconfig.json
- read-logs.py
- Проверка качества
- backend/package.json
- Устройство репозитория
- Направления развития Anyko
- logger/package.json
- Данные, доступ и фоновые задания
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- Размещение и эксплуатация
- Runtime и диагностика
- library.json
- contracts/src/index.ts
- worker.integration.test.ts
- Размещение основы в Dokploy
- architecture/tsconfig.json
- review-cases/README.md
- backend/tsconfig.json
- logger/tsconfig.json
- 202611050001_document_vertical/migration.sql
- database/package.json
- database/src/index.ts
- contracts/package.json
- document-worker.ts
- 0004-code-organization.md
- document-runtime.ts
- modules/documents/index.ts
- documents.integration.test.ts
- agent-workflow.md
- DocumentStore
- Инженерная основа Anyko
- Язык Anyko
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- dependencies.md
- Anyko
- web/AGENTS.md
- database/README.md

## God Nodes (most connected - your core abstractions)
1. `scripts` - 32 edges
2. `MVP: автоматизация подготовки заявления о банкротстве физического лица` - 14 edges
3. `SourceStorage` - 12 edges
4. `Logger` - 12 edges
5. `DocumentStore` - 11 edges
6. `createLogger()` - 11 edges
7. `compilerOptions` - 11 edges
8. `Anyko — брендбук` - 11 edges
9. `requestApi()` - 10 edges
10. `DocumentWorkspace()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GitHub App агента` --references--> `check()`  [INFERRED]
  docs/engineering/github-protection.md → tests/architecture/boundaries.test.ts
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  apps/api/src/app.ts → packages/logger/src/index.ts
- `DocumentHttpOptions` --references--> `createAccess()`  [EXTRACTED]
  apps/api/src/documents.ts → packages/backend/src/modules/access/infrastructure/auth.ts
- `DocumentHttpOptions` --references--> `createDocumentService()`  [EXTRACTED]
  apps/api/src/documents.ts → packages/backend/src/modules/documents/application/service.ts
- `upload()` --calls--> `requestApi()`  [EXTRACTED]
  apps/web/src/features/documents/document-workspace.tsx → apps/web/src/lib/api/client.ts

## Import Cycles
- None detected.

## Communities (70 total, 11 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.05
Nodes (37): dependencies, @anyko/contracts, @anyko/logger, next, react, react-dom, server-only, zod (+29 more)

### Community 1 - "package.json"
Cohesion: 0.04
Nodes (44): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/prettier-config, @anyko/typescript-config (+36 more)

### Community 2 - "agent-github.mjs"
Cohesion: 0.05
Nodes (42): { existsSync, readdirSync }, knownModules, moduleEdges, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки (+34 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.12
Nodes (15): 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система, 6. Типографика и композиция, 7. Голос и тексты (+7 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Примеры v1"
Cohesion: 0.25
Nodes (8): C1, C2, C3, C4, C5, C6, C7, Примеры v1

### Community 6 - "Правила написания кода"
Cohesion: 0.40
Nodes (5): Зависимости и читаемость, Ответственности и интерфейсы, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

### Community 7 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Доказательства, Изменение контроля, Независимое рассмотрение, Поведение и источник требования

### Community 8 - "Архитектура Anyko"
Cohesion: 0.25
Nodes (8): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, Архитектура Anyko

### Community 9 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 10 - "logger/src/index.ts"
Cohesion: 0.09
Nodes (24): createApp(), parseApiConfig(), schema, parseDocumentConfig(), schema, DocumentHttpOptions, documentRoutes(), startupResources (+16 more)

### Community 11 - "engineering/README.md"
Cohesion: 0.21
Nodes (4): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу

### Community 12 - "api/package.json"
Cohesion: 0.08
Nodes (25): dependencies, @anyko/backend, @anyko/logger, elysia, zod, devDependencies, @anyko/typescript-config, @types/bun (+17 more)

### Community 15 - "worker/package.json"
Cohesion: 0.08
Nodes (25): dependencies, @anyko/backend, @anyko/logger, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript (+17 more)

### Community 16 - "eslint-config/package.json"
Cohesion: 0.13
Nodes (14): exports, ./base, ./frontend, ./server, eslint, @eslint/js, typescript-eslint, name (+6 more)

### Community 17 - "scripts"
Cohesion: 0.06
Nodes (32): scripts, access:provision-local, agent:github, boundaries, build, check:project, db:generate, db:migrate (+24 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "prettier-config/package.json"
Cohesion: 0.18
Nodes (10): exports, ./backend, ./base, ./frontend, prettier, name, peerDependencies, prettier (+2 more)

### Community 21 - "architecture.js"
Cohesion: 0.24
Nodes (3): architectureRules, ioGlobals, restrictedIoGlobals

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "read-logs.py"
Cohesion: 0.08
Nodes (10): main(), InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query() (+2 more)

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "backend/package.json"
Cohesion: 0.06
Nodes (32): dependencies, @anyko/database, @anyko/logger, better-auth, @better-auth/prisma-adapter, bullmq, fflate, ioredis (+24 more)

### Community 27 - "Устройство репозитория"
Cohesion: 0.33
Nodes (6): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Устройство репозитория

### Community 28 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "Данные, доступ и фоновые задания"
Cohesion: 0.29
Nodes (7): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки

### Community 31 - "knip.json"
Cohesion: 0.20
Nodes (9): ignore, ignoreBinaries, entry, ignore, ignoreDependencies, $schema, workspaces, packages/backend (+1 more)

### Community 33 - "server.json"
Cohesion: 0.40
Nodes (4): compilerOptions, types, extends, ./base.json

### Community 34 - "api/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 36 - "worker/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 37 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "contracts/src/index.ts"
Cohesion: 0.07
Nodes (32): dynamic, relay(), HomePage(), SignIn(), SignOut(), DocumentWorkspace(), open(), retry() (+24 more)

### Community 41 - "worker.integration.test.ts"
Cohesion: 0.07
Nodes (24): documentsSchema, parseWorkerConfig(), schema, createMineruParser(), json(), localUrl(), readLimited(), request() (+16 more)

### Community 42 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "review-cases/README.md"
Cohesion: 0.21
Nodes (8): Ключ v1, Контрольные примеры для reviewer, Пробный прогон v1 — 5 ноября 2026, Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.12
Nodes (31): "Account", Account_userId_idx, "AnykoWorkspace", "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key (+23 more)

### Community 48 - "database/package.json"
Cohesion: 0.07
Nodes (25): dependencies, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma, @types/bun (+17 more)

### Community 49 - "database/src/index.ts"
Cohesion: 0.16
Nodes (11): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), nextRunRevision(), Connection, createProcessingCommands(), Start (+3 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "document-worker.ts"
Cohesion: 0.22
Nodes (10): DocumentParser, createSourceCleanup(), ProcessingClaim, ProcessingStore, createProcessingService(), createProcessingStore(), createDocumentWorker(), envelope (+2 more)

### Community 52 - "0004-code-organization.md"
Cohesion: 0.12
Nodes (13): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия, HTTP и данные, Запуск, Первая вертикаль обработки PDF (+5 more)

### Community 53 - "document-runtime.ts"
Cohesion: 0.16
Nodes (3): SourceStorage, createS3Storage(), Logger

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.27
Nodes (7): DocumentResult, DocumentStatus, DocumentView, documentResultSchema, DocumentError, DocumentService, statusSchema

### Community 55 - "documents.integration.test.ts"
Cohesion: 0.15
Nodes (8): db, files, logger, owned, pdf, runtime, storage, upload()

### Community 56 - "agent-workflow.md"
Cohesion: 0.20
Nodes (8): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions, Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 60 - "contracts/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/library.json

### Community 61 - "database/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 62 - "scripts/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 63 - "integration/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 65 - "Anyko"
Cohesion: 0.67
Nodes (3): Anyko, Запуск и диагностика, Разработка каркаса

## Knowledge Gaps
- **83 isolated node(s):** `@anyko/logger`, `zod`, `@anyko/backend`, `@anyko/typescript-config`, `@types/bun` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 601 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Защита GitHub` connect `agent-github.mjs` to `engineering/README.md`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **What connects `@anyko/logger`, `zod`, `@anyko/backend` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `agent-github.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05129561078794289 - nodes in this community are weakly interconnected._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `MVP: автоматизация подготовки заявления о банкротстве физического лица` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._