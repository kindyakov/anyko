# Graph Report - anyko  (2026-11-06)

## Corpus Check
- 258 files · ~124,114 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: (none) 6, .example 4, .pb 3)

## Summary
- 1593 nodes · 2908 edges · 123 communities (98 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb7fcc72`
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
- read-logs.py
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
- start-api.ts
- Проверка качества
- routes/works.ts
- devDependencies
- 202611050007_work_pipeline/migration.sql
- logger/package.json
- diagnostic-worker.test.ts
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- contracts/src/index.ts
- Runtime и диагностика
- library.json
- routes/works.ts
- processor.py
- dependencies
- architecture/tsconfig.json
- works.test.ts
- backend/tsconfig.json
- logger/tsconfig.json
- 202611050001_document_vertical/migration.sql
- database/package.json
- database/src/index.ts
- contracts/package.json
- document-deletion.test.ts
- src/works.ts
- llm/package.json
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
- Устройство репозитория
- continue-session.ts
- Работа агентов и независимая проверка
- agent-github.mjs
- ProcessorReview
- ref_node_path
- package-preview.tsx
- WorkStore
- check-project.mjs
- dev.mjs
- ref_node_fs
- logger/src/index.ts
- facts/index.ts
- Размещение и эксплуатация
- runtime/index.ts
- LogReaderTests
- document-deletion.test.ts
- smoke.py
- backend/package.json
- ref_bun_test
- templates/index.ts
- provision-llm.ts
- works/ports.ts
- WorkProcessingStore
- workspace.tsx
- architecture.md
- migrate-document-artifacts.ts
- work-detail.tsx
- templates.test.ts
- generation/index.ts
- Направления развития Anyko
- processing/index.ts
- layout.tsx
- llm/tsconfig.json
- VisualExportReview
- route.ts
- work-list.tsx
- Данные, доступ и фоновые задания
- access.test.ts
- Защита GitHub
- review-cases/README.md
- Работы, модели и заполнение документа
- Размещение основы в Dokploy
- Logger

## God Nodes (most connected - your core abstractions)
1. `scripts` - 39 edges
2. `WorkProcessingStore` - 23 edges
3. `requestApi()` - 22 edges
4. `SourceStorage` - 20 edges
5. `createDocumentWorker()` - 19 edges
6. `DocumentStore` - 18 edges
7. `createWorkRuntime()` - 18 edges
8. `Database` - 18 edges
9. `Logger` - 18 edges
10. `WorkApi` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `GitHub App агента` --references--> `check()`  [INFERRED]
  docs/engineering/github-protection.md → tests/architecture/boundaries.test.ts
- `startApi()` --calls--> `createAccess()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/modules/access/infrastructure/auth.ts
- `startApi()` --calls--> `createDocumentRuntime()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/runtime/documents/api.ts
- `startApi()` --calls--> `parseWorkConfig()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/runtime/works/config.ts

## Import Cycles
- None detected.

## Communities (123 total, 25 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.14
Nodes (13): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+5 more)

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (23): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, eslint, @eslint/js (+15 more)

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
Cohesion: 0.20
Nodes (9): C1, C2, C3, C4, C5, C6, C7, Примеры v1 (+1 more)

### Community 6 - "Правила написания кода"
Cohesion: 0.40
Nodes (5): Зависимости и читаемость, Ответственности и интерфейсы, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

### Community 7 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Доказательства, Изменение контроля, Независимое рассмотрение, Поведение и источник требования

### Community 8 - "Архитектура Anyko"
Cohesion: 0.22
Nodes (9): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, 8. Продолжение агентской сессии (+1 more)

### Community 9 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 10 - "read-logs.py"
Cohesion: 0.19
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "engineering/README.md"
Cohesion: 0.23
Nodes (3): graphify, Бланки пакета банкротства, Подготовка следующей версии

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
Cohesion: 0.05
Nodes (39): scripts, access:provision-local, agent:github, artifacts:migrate, boundaries, build, check:project, db:generate (+31 more)

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

### Community 24 - "start-api.ts"
Cohesion: 0.27
Nodes (6): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi(), createS3Storage()

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "routes/works.ts"
Cohesion: 0.14
Nodes (4): HTTP, SSE и настройки, WorkApi, WorkPage, WorkView

### Community 27 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/prettier-config, @anyko/typescript-config (+12 more)

### Community 28 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.08
Nodes (45): "LlmSettings", "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx (+37 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "diagnostic-worker.test.ts"
Cohesion: 0.13
Nodes (9): resultSchema, runDiagnostic(), envelope, State, envelope, createWorkCleanup(), logger, bullmq (+1 more)

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

### Community 37 - "contracts/src/index.ts"
Cohesion: 0.14
Nodes (13): labels, ResultPreview(), SourcePreview(), documentResponseSchema, documentResultSchema, documentSchema, documentsResponseSchema, DocumentSummary (+5 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "routes/works.ts"
Cohesion: 0.19
Nodes (14): createApp(), authRoutes(), DocumentHttpOptions, documentRoutes(), connections, workEventStream(), body(), id() (+6 more)

### Community 41 - "processor.py"
Cohesion: 0.13
Nodes (3): erase(), health(), parse()

### Community 42 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @anyko/contracts, @anyko/logger, katex, next, react, react-dom, react-markdown (+7 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "works.test.ts"
Cohesion: 0.06
Nodes (31): descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), reconciliationSchema, agents (+23 more)

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
Cohesion: 0.18
Nodes (11): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands() (+3 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "document-deletion.test.ts"
Cohesion: 0.17
Nodes (19): createDocumentAgents(), Connection, createAgentSessionStore(), createDocumentIo(), createGenerationStore(), createLlmSettingsStore(), createWorkProcessingStore(), Connection (+11 more)

### Community 52 - "src/works.ts"
Cohesion: 0.08
Nodes (28): agentSessionContextSchema, agentSessionSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, PreviewBlock, previewBlockSchema, previewCellSchema (+20 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.12
Nodes (26): checksum(), Artifact, ArtifactRegistry, DocumentIo, DocumentParser, DocumentResult, DocumentStatus, DocumentView (+18 more)

### Community 55 - "documents.test.ts"
Cohesion: 0.10
Nodes (11): SourceStorage, createSourceCleanup(), contentTypes, db, files, logger, owned, pdf (+3 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.11
Nodes (16): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+8 more)

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
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "continue-session.ts"
Cohesion: 0.13
Nodes (14): AgentDocument, AgentUsage, DocumentAgents, combineCandidates(), Reconciliation, selectSessionCandidates(), FactsStore, WorkSummary (+6 more)

### Community 78 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 79 - "agent-github.mjs"
Cohesion: 0.33
Nodes (10): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken(), permissions, readResponse(), request() (+2 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "ref_node_path"
Cohesion: 0.20
Nodes (5): cases, cli, config, root, [target, link]

### Community 82 - "package-preview.tsx"
Cohesion: 0.36
Nodes (8): PackagePreview(), Props, FieldEditor(), TextSlot(), DocumentPackage, FieldKey, FieldRow, FieldValue

### Community 84 - "check-project.mjs"
Cohesion: 0.22
Nodes (5): documents, errors, manifests, markdownFiles(), root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "ref_node_fs"
Cohesion: 0.25
Nodes (4): { existsSync, readdirSync }, knownModules, moduleEdges, result

### Community 87 - "logger/src/index.ts"
Cohesion: 0.33
Nodes (4): createLogger(), fields, LogEvent, LogLevel

### Community 88 - "facts/index.ts"
Cohesion: 0.24
Nodes (13): confirmFacts(), editFacts(), emptyFacts(), findFactConflicts(), mergeCandidates(), reconcile(), stable(), createFactsStore() (+5 more)

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 90 - "runtime/index.ts"
Cohesion: 0.16
Nodes (13): documentsSchema, parseWorkerConfig(), schema, startWorker(), createMineruParser(), createWorkerRuntime(), flag, parseWorkConfig() (+5 more)

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.15
Nodes (15): StorageWriteOutcomeUnknown, createArtifactRegistry(), createDeletionStore(), ProcessingClaim, ProcessingStore, createProcessingService(), createProcessingStore(), createDocumentWorker() (+7 more)

### Community 95 - "backend/package.json"
Cohesion: 0.05
Nodes (43): dependencies, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+35 more)

### Community 97 - "templates/index.ts"
Cohesion: 0.14
Nodes (15): pack, paragraph(), bankruptcyPackage, historicalPackage, previousPackage, templateData(), bytes, requireTemplate() (+7 more)

### Community 99 - "works/ports.ts"
Cohesion: 0.12
Nodes (4): AgentSessionStore, GenerationStore, WorkStores, AgentSession

### Community 101 - "workspace.tsx"
Cohesion: 0.22
Nodes (8): DocumentsPage(), HomePage(), WorkPage(), Workspace(), SignIn(), SignOut(), Session, react

### Community 102 - "architecture.md"
Cohesion: 0.12
Nodes (11): Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия (+3 more)

### Community 103 - "migrate-document-artifacts.ts"
Cohesion: 0.33
Nodes (5): db, env, legacy, locks, storage

### Community 104 - "work-detail.tsx"
Cohesion: 0.21
Nodes (11): SessionContext(), UploadFailure, uploadFailureMessage(), accepted, stages, statuses, WorkDetail(), command() (+3 more)

### Community 105 - "templates.test.ts"
Cohesion: 0.32
Nodes (9): generateDocument(), templateBytes(), createWorkContinuation(), createWorkExecution(), delay(), StepInput, addUsage(), callModel() (+1 more)

### Community 106 - "generation/index.ts"
Cohesion: 0.38
Nodes (5): GenerationFile, GenerationRecord, FieldValues, docxtemplater, pizzip

### Community 107 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 108 - "processing/index.ts"
Cohesion: 0.19
Nodes (8): LlmConfiguration, LlmSettingsStore, StepOutput, stepOutputSchema, WorkRunRecord, Connection, kindSchema, workRunSchema

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 112 - "route.ts"
Cohesion: 0.17
Nodes (10): dynamic, relay(), register(), HttpFetch, proxyApiRequest(), requestHeaders, responseHeaders, readServerConfig() (+2 more)

### Community 113 - "work-list.tsx"
Cohesion: 0.16
Nodes (16): config, DocumentWorkspace(), open(), remove(), retry(), upload(), message(), LlmSettings() (+8 more)

### Community 117 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (8): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки, Владельцы и исполнение

### Community 118 - "access.test.ts"
Cohesion: 0.16
Nodes (11): AccessOptions, buildAuth(), createAccess(), provisionLocalAccess(), llmSettingsResponseSchema, better-auth, @better-auth/prisma-adapter, config (+3 more)

### Community 119 - "Защита GitHub"
Cohesion: 0.29
Nodes (6): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, check()

### Community 121 - "Работы, модели и заполнение документа"
Cohesion: 0.33
Nodes (6): Агентский контекст и данные, Локальный запуск и доказательства, Повторы визуального анализа, Полное удаление и восстановление, Постоянный контекст работы, Работы, модели и заполнение документа

### Community 123 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

## Knowledge Gaps
- **92 isolated node(s):** `@anyko/logger`, `zod`, `@anyko/backend`, `@anyko/typescript-config`, `@types/bun` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 829 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Контрольные примеры для reviewer` connect `Примеры v1` to `review-cases/README.md`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `@anyko/logger`, `zod`, `@anyko/backend` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `AgentSessionStore` connect `works/ports.ts` to `Примеры v1`, `document-deletion.test.ts`, `continue-session.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `Работы, модели и заполнение документа` connect `Работы, модели и заполнение документа` to `routes/works.ts`, `engineering/README.md`, `Данные, доступ и фоновые задания`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._