# Graph Report - anyko  (2026-11-09)

## Corpus Check
- 290 files · ~149,335 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 4)

## Summary
- 1785 nodes · 3582 edges · 124 communities (104 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cdaf51da`
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
- routes/works.ts
- read-logs.py
- 202611050007_work_pipeline/migration.sql
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- worker/src/bootstrap/config.ts
- architecture.js
- exports
- web/tsconfig.json
- 202611050001_document_vertical/migration.sql
- Проверка качества
- Язык Anyko
- workspace.tsx
- logger/package.json
- startBlackHole
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- Button
- Runtime и диагностика
- library.json
- llmError
- processor.py
- dependencies
- architecture/tsconfig.json
- diagnostic-worker.test.ts
- backend/tsconfig.json
- logger/tsconfig.json
- WorkApi
- database/package.json
- database/src/index.ts
- contracts/package.json
- contracts/src/index.ts
- src/works.ts
- llm/package.json
- modules/documents/index.ts
- documents.test.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- work-sources.tsx
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- dependencies.md
- ref_zod
- backend/package.json
- database/README.md
- Processor
- devDependencies
- deep-sky.ts
- works.test.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- DocumentAgents
- WorkStore
- agent-github.mjs
- ProcessorReview
- boundaries.test.ts
- DocumentStore
- devDependencies
- check-project.mjs
- dev.mjs
- work-list.tsx
- runtime/index.ts
- facts/index.ts
- Размещение и эксплуатация
- execute.ts
- LogReaderTests
- document-deletion.test.ts
- ref_node_fs
- smoke.py
- app.ts
- result-preview.tsx
- layout.tsx
- continue-session.ts
- GenerationStore
- WorkProcessingStore
- work-review.tsx
- engineering/README.md
- resources.ts
- WorkStore
- smoke-document.ts
- document-workspace.tsx
- Направления развития Anyko
- infrastructure/auth.ts
- migrate-document-artifacts.ts
- llm/tsconfig.json
- VisualExportReview
- ref_bun_test
- access.test.ts
- Anyko
- Feature-based web и модульный backend с ports/adapters
- templates/index.ts
- Agent skills
- server/config.ts
- Работа агентов и независимая проверка
- prepare-storage.ts

## God Nodes (most connected - your core abstractions)
1. `Button()` - 41 edges
2. `scripts` - 41 edges
3. `react` - 27 edges
4. `lucide-react` - 23 edges
5. `WorkProcessingStore` - 23 edges
6. `WorkDetail()` - 22 edges
7. `requestApi()` - 21 edges
8. `DocumentWorkspace()` - 20 edges
9. `SourceStorage` - 20 edges
10. `EventHorizon()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `Интерфейс` --references--> `requestApi()`  [INFERRED]
  apps/web/AGENTS.md → apps/web/src/lib/api/client.ts
- `GitHub App агента` --references--> `check()`  [INFERRED]
  docs/engineering/github-protection.md → tests/architecture/boundaries.test.ts
- `startApi()` --calls--> `createAccess()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/modules/access/infrastructure/auth.ts
- `startApi()` --calls--> `createDocumentRuntime()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/runtime/documents/api.ts

## Import Cycles
- None detected.

## Communities (124 total, 20 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.11
Nodes (17): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+9 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, eslint, @eslint/js (+13 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.17
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (17): This is NOT the Next.js you know, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система (+9 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Примеры v1"
Cohesion: 0.15
Nodes (11): C1, C2, C3, C4, C5, C6, C7, Примеры v1 (+3 more)

### Community 6 - "Правила написания кода"
Cohesion: 0.40
Nodes (5): Зависимости и читаемость, Ответственности и интерфейсы, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

### Community 7 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Доказательства, Изменение контроля, Независимое рассмотрение, Поведение и источник требования

### Community 8 - "Архитектура Anyko"
Cohesion: 0.22
Nodes (9): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, 8. Продолжение агентской сессии (+1 more)

### Community 9 - "routes/works.ts"
Cohesion: 0.27
Nodes (8): connections, workEventStream(), body(), id(), workRoutes(), WorkError, WorkSummary, llmSettingsInputSchema

### Community 10 - "read-logs.py"
Cohesion: 0.19
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.08
Nodes (44): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+36 more)

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
Nodes (41): scripts, access:provision-local, agent:github, artifacts:migrate, boundaries, build, check:project, db:generate (+33 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "worker/src/bootstrap/config.ts"
Cohesion: 0.47
Nodes (3): documentsSchema, parseWorkerConfig(), schema

### Community 21 - "architecture.js"
Cohesion: 0.24
Nodes (3): architectureRules, ioGlobals, restrictedIoGlobals

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.07
Nodes (44): "Account", Account_userId_idx, "AnykoWorkspace", "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key (+36 more)

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 27 - "workspace.tsx"
Cohesion: 0.27
Nodes (8): Logo(), DocumentsPage(), HomePage(), WorkPage(), Workspace(), CosmicBackground(), expireSession(), @tanstack/react-query

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "startBlackHole"
Cohesion: 0.15
Nodes (15): HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole(), paint() (+7 more)

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

### Community 37 - "Button"
Cohesion: 0.15
Nodes (20): AppShell(), navigation, Button(), Size, sizes, Variant, variants, Confirm() (+12 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "llmError"
Cohesion: 0.36
Nodes (4): invalidResponse(), retryVisionResponse(), failureCode(), llmError

### Community 41 - "processor.py"
Cohesion: 0.13
Nodes (3): erase(), health(), parse()

### Community 42 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @anyko/contracts, @anyko/logger, @base-ui/react, katex, lucide-react, next, react (+11 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "diagnostic-worker.test.ts"
Cohesion: 0.10
Nodes (11): resultSchema, runDiagnostic(), envelope, State, logger, fields, LogEvent, Logger (+3 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "WorkApi"
Cohesion: 0.15
Nodes (4): HTTP, SSE и настройки, WorkApi, WorkPage, WorkView

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (29): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+21 more)

### Community 49 - "database/src/index.ts"
Cohesion: 0.18
Nodes (12): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands() (+4 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "contracts/src/index.ts"
Cohesion: 0.07
Nodes (28): config, active(), errors, journeySteps, newest(), Run, runStatusLabels, stageLabels (+20 more)

### Community 52 - "src/works.ts"
Cohesion: 0.07
Nodes (30): pack, paragraph(), documentPackageSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock (+22 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.11
Nodes (26): checksum(), Artifact, ArtifactRegistry, DocumentIo, DocumentParser, DocumentResult, DocumentStatus, DocumentView (+18 more)

### Community 55 - "documents.test.ts"
Cohesion: 0.11
Nodes (11): SourceStorage, createSourceCleanup(), contentTypes, db, files, logger, owned, pdf (+3 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.09
Nodes (17): Один модульный монолит с отдельными процессами, HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1` (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "work-sources.tsx"
Cohesion: 0.12
Nodes (30): Disclosure(), absolute, formatRelative(), relative, RelativeTime(), units, Spinner(), delays (+22 more)

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

### Community 65 - "ref_zod"
Cohesion: 0.18
Nodes (12): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), fieldDefinitions, connectionSchema, createModelGateway(), LlmErrorCode (+4 more)

### Community 66 - "backend/package.json"
Cohesion: 0.04
Nodes (44): dependencies, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+36 more)

### Community 71 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, @anyko/typescript-config, tailwindcss, @tailwindcss/postcss, @types/bun, @types/node, @types/react, @types/react-dom (+2 more)

### Community 72 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 73 - "works.test.ts"
Cohesion: 0.11
Nodes (15): agents, analyze(), create(), db, files, fixtureImage, imageFixture, logger (+7 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "DocumentAgents"
Cohesion: 0.19
Nodes (5): DocumentAgents, WorkRuntimeOptions, FieldDefinition, WorkFacts, ModelConnection

### Community 79 - "agent-github.mjs"
Cohesion: 0.33
Nodes (10): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken(), permissions, readResponse(), request() (+2 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "boundaries.test.ts"
Cohesion: 0.15
Nodes (10): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, cases, check(), cli (+2 more)

### Community 83 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3 (+10 more)

### Community 84 - "check-project.mjs"
Cohesion: 0.22
Nodes (5): documents, errors, manifests, markdownFiles(), root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "work-list.tsx"
Cohesion: 0.30
Nodes (9): FormField(), HoverMist(), Input(), SignIn(), useListPreferences, LlmSettings(), Journey(), WorkList() (+1 more)

### Community 87 - "runtime/index.ts"
Cohesion: 0.11
Nodes (17): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi(), startWorker(), createMineruParser(), createS3Storage() (+9 more)

### Community 88 - "facts/index.ts"
Cohesion: 0.24
Nodes (13): confirmFacts(), editFacts(), emptyFacts(), findFactConflicts(), mergeCandidates(), reconcile(), stable(), createFactsStore() (+5 more)

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.15
Nodes (11): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов, Восстановление и данные, Начальная топология, Порядок выпуска (+3 more)

### Community 90 - "execute.ts"
Cohesion: 0.20
Nodes (14): WorkRunRecord, templateBytes(), createWorkWorker(), envelope, createWorkCleanup(), ContinuationSource, createWorkContinuation(), createWorkExecution() (+6 more)

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.18
Nodes (11): createDeletionStore(), ProcessingClaim, ProcessingStore, createProcessingService(), createProcessingStore(), createDocumentWorker(), envelope, createDocumentDeletionWorkflow() (+3 more)

### Community 93 - "ref_node_fs"
Cohesion: 0.15
Nodes (7): { existsSync, readdirSync }, knownModules, moduleEdges, hook, root, result, [target, link]

### Community 95 - "app.ts"
Cohesion: 0.31
Nodes (8): createApp(), authRoutes(), DocumentHttpOptions, documentRoutes(), WorkHttpOptions, createAccess(), createLogger(), elysia

### Community 96 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 97 - "layout.tsx"
Cohesion: 0.28
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 98 - "continue-session.ts"
Cohesion: 0.17
Nodes (13): AgentDocument, AgentUsage, Connection, AgentSessionStore, combineCandidates(), Reconciliation, reconciliationSchema, selectSessionCandidates() (+5 more)

### Community 99 - "GenerationStore"
Cohesion: 0.12
Nodes (4): DocumentService, FactsStore, GenerationStore, WorkStores

### Community 100 - "WorkProcessingStore"
Cohesion: 0.08
Nodes (9): LlmConfiguration, LlmSettingsStore, StepOutput, stepOutputSchema, WorkProcessingStore, Connection, kindSchema, candidateSchema (+1 more)

### Community 101 - "work-review.tsx"
Cohesion: 0.16
Nodes (20): EventHorizon(), HorizonState, moods, fieldSurface, conflictingFields(), mentions(), PackagePreview(), Props (+12 more)

### Community 102 - "engineering/README.md"
Cohesion: 0.15
Nodes (8): graphify, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Бланки пакета банкротства, Подготовка следующей версии

### Community 103 - "resources.ts"
Cohesion: 0.16
Nodes (18): createAgentSessionStore(), createArtifactRegistry(), createDocumentIo(), createGenerationStore(), createLlmSettingsStore(), createWorkProcessingStore(), Connection, createWorkStore() (+10 more)

### Community 104 - "WorkStore"
Cohesion: 0.13
Nodes (14): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки, Агентский контекст и данные (+6 more)

### Community 105 - "smoke-document.ts"
Cohesion: 0.22
Nodes (5): documentResultSchema, documentSchema, documentsResponseSchema, DocumentSummary, config

### Community 106 - "document-workspace.tsx"
Cohesion: 0.18
Nodes (19): buttonStyles(), SegmentedControl(), Skeleton(), documentKind(), DocumentViewer(), Mode, Original(), PaperSkeleton() (+11 more)

### Community 107 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 108 - "infrastructure/auth.ts"
Cohesion: 0.25
Nodes (7): AccessOptions, buildAuth(), provisionLocalAccess(), better-auth, @better-auth/prisma-adapter, config, schema

### Community 109 - "migrate-document-artifacts.ts"
Cohesion: 0.20
Nodes (7): StorageWriteOutcomeUnknown, put(), db, env, legacy, locks, storage

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 112 - "ref_bun_test"
Cohesion: 0.21
Nodes (7): dynamic, relay(), HttpFetch, proxyApiRequest(), requestHeaders, responseHeaders, readServerConfig()

### Community 113 - "access.test.ts"
Cohesion: 0.29
Nodes (3): llmSettingsResponseSchema, delete(), get()

### Community 114 - "Anyko"
Cohesion: 0.67
Nodes (3): Anyko, Запуск и диагностика, Разработка каркаса

### Community 115 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 116 - "templates/index.ts"
Cohesion: 0.14
Nodes (18): GenerationFile, GenerationRecord, generateDocument(), bankruptcyPackage, historicalPackage, previousPackage, templateData(), bytes (+10 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "server/config.ts"
Cohesion: 0.40
Nodes (3): register(), schema, server-only

### Community 122 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

## Knowledge Gaps
- **91 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 888 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Работы, модели и заполнение документа` connect `WorkStore` to `engineering/README.md`, `WorkApi`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `HTTP, SSE и настройки` connect `WorkApi` to `WorkStore`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `MVP: автоматизация подготовки заявления о банкротстве физического лица` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._