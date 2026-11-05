# Graph Report - anyko  (2026-11-05)

## Corpus Check
- 178 files · ~78,643 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 6, .example 4, .pb 3)

## Summary
- 1118 nodes · 1711 edges · 92 communities (76 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4cdbd9d0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- Anyko — брендбук
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- Примеры v1
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- Agent skills
- dependencies
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
- logger/src/index.ts
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
- Размещение основы в Dokploy
- Runtime и диагностика
- library.json
- contracts/src/index.ts
- processor.py
- dependencies
- architecture/tsconfig.json
- review-cases/README.md
- backend/tsconfig.json
- logger/tsconfig.json
- 202611050001_document_vertical/migration.sql
- database/package.json
- database/src/index.ts
- contracts/package.json
- document-deletion.test.ts
- logger/src/index.ts
- source-format.ts
- modules/documents/index.ts
- documents.test.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
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
- Processor
- devDependencies
- result-preview.tsx
- DocumentStore
- scripts
- Проверка тестов, написанных агентом
- Feature-based web и модульный backend с ports/adapters
- Logger
- Работа агентов и независимая проверка
- agent-github.mjs
- ProcessorReview
- boundaries.test.ts
- store.ts
- devDependencies
- check-project.mjs
- dev.mjs
- ref_node_fs
- exports
- ref_node_path
- Размещение и эксплуатация
- layout.tsx

## God Nodes (most connected - your core abstractions)
1. `scripts` - 35 edges
2. `DocumentStore` - 17 edges
3. `createDocumentWorker()` - 17 edges
4. `SourceStorage` - 15 edges
5. `createLogger()` - 14 edges
6. `MVP: автоматизация подготовки заявления о банкротстве физического лица` - 14 edges
7. `createDocumentRuntime()` - 13 edges
8. `Logger` - 13 edges
9. `createDatabase()` - 12 edges
10. `DocumentWorkspace()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `GitHub App агента` --references--> `check()`  [INFERRED]
  docs/engineering/github-protection.md → tests/architecture/boundaries.test.ts
- `startApi()` --calls--> `createDocumentRuntime()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/runtime/documents/api.ts
- `DocumentHttpOptions` --references--> `createDocumentService()`  [EXTRACTED]
  apps/api/src/http/routes/documents.ts → packages/backend/src/modules/documents/application/service.ts
- `startWorker()` --calls--> `createDocumentWorker()`  [EXTRACTED]
  apps/worker/src/bootstrap/start-worker.ts → packages/backend/src/runtime/documents/worker.ts

## Import Cycles
- None detected.

## Communities (92 total, 16 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.13
Nodes (14): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+6 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (43): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/prettier-config, @anyko/typescript-config (+35 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.22
Nodes (8): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, directories, work

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

### Community 10 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, @anyko/database, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, bullmq, fflate (+2 more)

### Community 11 - "engineering/README.md"
Cohesion: 0.20
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
Nodes (35): scripts, access:provision-local, agent:github, artifacts:migrate, boundaries, build, check:project, db:generate (+27 more)

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

### Community 24 - "logger/src/index.ts"
Cohesion: 0.17
Nodes (6): resultSchema, envelope, State, logger, bullmq, ioredis

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "backend/package.json"
Cohesion: 0.12
Nodes (15): @anyko/database, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, @types/bun, typescript, @typescript/native, zod (+7 more)

### Community 27 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 28 - "Направления развития Anyko"
Cohesion: 0.29
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

### Community 37 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "contracts/src/index.ts"
Cohesion: 0.07
Nodes (35): dynamic, relay(), HomePage(), SignIn(), SignOut(), DocumentWorkspace(), open(), remove() (+27 more)

### Community 41 - "processor.py"
Cohesion: 0.06
Nodes (13): erase(), health(), parse(), main(), InvalidQuery, journal_command(), main(), parse_time() (+5 more)

### Community 42 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @anyko/contracts, @anyko/logger, katex, next, react, react-dom, react-markdown (+7 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "review-cases/README.md"
Cohesion: 0.43
Nodes (3): Ключ v1, Контрольные примеры для reviewer, Пробный прогон v1 — 5 ноября 2026

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.08
Nodes (43): "Account", Account_userId_idx, "AnykoWorkspace", "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key (+35 more)

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "database/src/index.ts"
Cohesion: 0.16
Nodes (12): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands() (+4 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "document-deletion.test.ts"
Cohesion: 0.16
Nodes (14): SourceStorage, createArtifactRegistry(), createDeletionStore(), createDocumentIo(), createSourceCleanup(), createDocumentRuntime(), createDocumentWorker(), envelope (+6 more)

### Community 52 - "logger/src/index.ts"
Cohesion: 0.05
Nodes (39): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi(), createApp(), authRoutes(), DocumentHttpOptions (+31 more)

### Community 53 - "source-format.ts"
Cohesion: 0.25
Nodes (10): formats, isDocx(), matchesSourceFormat(), sourceContentTypes, SourceFormat, startsWith(), contentTypes, docx (+2 more)

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.14
Nodes (18): checksum(), Artifact, ArtifactRegistry, DocumentIo, DocumentParser, DocumentResult, DocumentStatus, DocumentView (+10 more)

### Community 55 - "documents.test.ts"
Cohesion: 0.14
Nodes (9): contentTypes, db, files, logger, owned, pdf, runtime, storage (+1 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.17
Nodes (10): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, Контракт процессора, Локальный stateless MinerU (+2 more)

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

### Community 71 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @anyko/typescript-config, @types/bun, @types/node, @types/react, @types/react-dom, typescript, @typescript/native

### Community 72 - "result-preview.tsx"
Cohesion: 0.20
Nodes (8): schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 78 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (9): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken(), permissions, readResponse(), request() (+1 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "boundaries.test.ts"
Cohesion: 0.17
Nodes (10): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, cases, check(), cli (+2 more)

### Community 82 - "store.ts"
Cohesion: 0.36
Nodes (4): ProcessingClaim, ProcessingStore, createProcessingService(), createProcessingStore()

### Community 83 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 84 - "check-project.mjs"
Cohesion: 0.25
Nodes (5): documents, errors, manifests, markdownFiles(), root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "ref_node_fs"
Cohesion: 0.25
Nodes (4): { existsSync, readdirSync }, knownModules, moduleEdges, result

### Community 87 - "exports"
Cohesion: 0.50
Nodes (4): exports, ./access, ./documents, ./runtime

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

## Knowledge Gaps
- **85 isolated node(s):** `@anyko/logger`, `zod`, `@anyko/backend`, `@anyko/typescript-config`, `@types/bun` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 656 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Защита GitHub` connect `boundaries.test.ts` to `engineering/README.md`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `@anyko/logger`, `zod`, `@anyko/backend` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `MVP: автоматизация подготовки заявления о банкротстве физического лица` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `api/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._