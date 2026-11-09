# Graph Report - anyko  (2026-11-09)

## Corpus Check
- 311 files · ~174,730 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 4)

## Summary
- 1847 nodes · 3678 edges · 136 communities (115 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `093afce6`
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
- launcher.py
- read-logs.py
- work-pipeline.tsx
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- ref_node_path
- architecture.js
- exports
- web/tsconfig.json
- portable_shutdown.py
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
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- diagnostic-worker.test.ts
- backend/tsconfig.json
- logger/tsconfig.json
- WorkApi
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- document-viewer.tsx
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
- unit-of-work.ts
- WorkStore
- agent-github.mjs
- ProcessorReview
- Защита GitHub
- DocumentStore
- stage-windows-migrator.mjs
- check-project.mjs
- dev.mjs
- work-list.tsx
- runtime/index.ts
- facts/index.ts
- Размещение и эксплуатация
- works/ports.ts
- LogReaderTests
- document-deletion.test.ts
- ref_node_fs
- smoke-windows-release.py
- access.test.ts
- stage-windows-mineru.mjs
- layout.tsx
- works/ports.ts
- GenerationStore
- WorkProcessingStore
- work-review.tsx
- engineering/README.md
- resources.ts
- Работы, модели и заполнение документа
- app.ts
- bootstrap.mjs
- Направления развития Anyko
- work-detail.tsx
- Данные, доступ и фоновые задания
- llm/tsconfig.json
- build-windows-portable.mjs
- api/client.ts
- boundaries.test.ts
- Anyko
- Feature-based web и модульный backend с ports/adapters
- templates/index.ts
- Размещение основы в Dokploy
- stage-windows-web.mjs
- ModelHandler
- Agent skills
- work-pipeline.md
- Работа агентов и независимая проверка
- build-windows-web.mjs
- routes/works.ts
- processing/index.ts
- result-preview.tsx
- start-api.ts
- WorkList
- migrate-document-artifacts.ts
- stage-windows-infrastructure.mjs
- Локальный stateless MinerU
- mineru.test.ts
- work-ports.ts
- prepare-storage.ts
- provision-llm.ts

## God Nodes (most connected - your core abstractions)
1. `scripts` - 52 edges
2. `Button()` - 41 edges
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
- `startApi()` --calls--> `createS3Storage()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/modules/documents/infrastructure/s3-storage.ts

## Import Cycles
- None detected.

## Communities (136 total, 21 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.12
Nodes (15): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+7 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (39): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3 (+31 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.13
Nodes (15): hook, root, createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root (+7 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (17): This is NOT the Next.js you know, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система (+9 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Примеры v1"
Cohesion: 0.16
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

### Community 9 - "launcher.py"
Cohesion: 0.14
Nodes (16): BasicLimits, command(), create_job(), create_mutex(), ExtendedLimits, invoke(), IoCounters, listener_owned() (+8 more)

### Community 10 - "read-logs.py"
Cohesion: 0.17
Nodes (9): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query(), request() (+1 more)

### Community 11 - "work-pipeline.tsx"
Cohesion: 0.17
Nodes (14): fileExtension(), FileIcon(), errorText(), runStatusLabels, stageLabels, stepStatusLabels, Connector(), Document (+6 more)

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
Cohesion: 0.04
Nodes (52): scripts, access:provision-local, agent:github, artifacts:migrate, boundaries, build, build:windows, build:windows:components (+44 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "ref_node_path"
Cohesion: 0.14
Nodes (9): output, components, env, metadata, python, pythonRelative, root, source (+1 more)

### Community 21 - "architecture.js"
Cohesion: 0.24
Nodes (3): architectureRules, ioGlobals, restrictedIoGlobals

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "portable_shutdown.py"
Cohesion: 0.33
Nodes (3): main(), port(), ready()

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 27 - "workspace.tsx"
Cohesion: 0.16
Nodes (16): AppShell(), Logo(), DocumentsPage(), HomePage(), WorkPage(), Workspace(), CosmicBackground(), EventHorizon() (+8 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "startBlackHole"
Cohesion: 0.18
Nodes (12): HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole(), paint() (+4 more)

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
Nodes (21): Button(), Size, sizes, Variant, variants, Confirm(), DropZone(), Flying (+13 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.15
Nodes (9): appdata, bin, data, env, identity, infra, migrator, migratorSource (+1 more)

### Community 41 - "processor.py"
Cohesion: 0.08
Nodes (6): erase(), health(), parse(), visual_inputs(), main(), VisualExportReview

### Community 42 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @anyko/contracts, @anyko/logger, @base-ui/react, katex, lucide-react, next, react (+11 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "diagnostic-worker.test.ts"
Cohesion: 0.18
Nodes (7): resultSchema, runDiagnostic(), envelope, State, logger, bullmq, ioredis

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "WorkApi"
Cohesion: 0.14
Nodes (4): HTTP, SSE и настройки, WorkApi, WorkPage, WorkView

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (29): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+21 more)

### Community 49 - "stage-windows-release.mjs"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "document-viewer.tsx"
Cohesion: 0.19
Nodes (16): Modal(), documentKind(), DocumentViewer(), Mode, Original(), PaperSkeleton(), ViewedDocument, DocumentWorkspace() (+8 more)

### Community 52 - "src/works.ts"
Cohesion: 0.07
Nodes (31): agentSessionContextSchema, agentSessionSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema (+23 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.14
Nodes (23): checksum(), Artifact, ArtifactRegistry, DocumentIo, DocumentParser, DocumentResult, DocumentStatus, DocumentView (+15 more)

### Community 55 - "documents.test.ts"
Cohesion: 0.11
Nodes (11): SourceStorage, createSourceCleanup(), contentTypes, db, files, logger, owned, pdf (+3 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.14
Nodes (12): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+4 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "work-sources.tsx"
Cohesion: 0.22
Nodes (14): buttonStyles(), Disclosure(), absolute, formatRelative(), relative, RelativeTime(), units, Notice() (+6 more)

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
Cohesion: 0.15
Nodes (15): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), connectionSchema (+7 more)

### Community 66 - "backend/package.json"
Cohesion: 0.04
Nodes (46): dependencies, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+38 more)

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

### Community 77 - "unit-of-work.ts"
Cohesion: 0.18
Nodes (11): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands() (+3 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.33
Nodes (10): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken(), permissions, readResponse(), request() (+2 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "Защита GitHub"
Cohesion: 0.33
Nodes (6): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, check()

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "check-project.mjs"
Cohesion: 0.22
Nodes (5): documents, errors, manifests, markdownFiles(), root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "work-list.tsx"
Cohesion: 0.19
Nodes (12): config, navigation, FormField(), Input(), Skeleton(), SignIn(), SignOut(), LlmSettings() (+4 more)

### Community 87 - "runtime/index.ts"
Cohesion: 0.15
Nodes (14): documentsSchema, parseWorkerConfig(), schema, startWorker(), createMineruParser(), createS3Storage(), createWorkerRuntime(), flag (+6 more)

### Community 88 - "facts/index.ts"
Cohesion: 0.22
Nodes (11): confirmFacts(), editFacts(), emptyFacts(), FactsStore, findFactConflicts(), mergeCandidates(), reconcile(), stable() (+3 more)

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 90 - "works/ports.ts"
Cohesion: 0.15
Nodes (7): DocumentService, WorkRuntimeOptions, envelope, createWorkCleanup(), WorkDependencies, WorkStores, Logger

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.14
Nodes (9): StorageWriteOutcomeUnknown, createDocumentDeletionWorkflow(), delete(), get(), logger, put(), fields, LogEvent (+1 more)

### Community 93 - "ref_node_fs"
Cohesion: 0.14
Nodes (7): { existsSync, readdirSync }, knownModules, moduleEdges, links, marker, result, [target, link]

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.15
Nodes (5): descendant_handles(), start(), child(), dead(), supervisor()

### Community 95 - "access.test.ts"
Cohesion: 0.17
Nodes (10): AccessOptions, buildAuth(), createAccess(), provisionLocalAccess(), llmSettingsResponseSchema, workResponseSchema, config, schema (+2 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "layout.tsx"
Cohesion: 0.28
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 98 - "works/ports.ts"
Cohesion: 0.12
Nodes (17): AgentDocument, AgentUsage, DocumentAgents, AgentSessionStore, combineCandidates(), Reconciliation, selectSessionCandidates(), WorkSummary (+9 more)

### Community 101 - "work-review.tsx"
Cohesion: 0.20
Nodes (18): fieldSurface, SegmentedControl(), conflictingFields(), mentions(), PackagePreview(), Props, zooms, CandidateValue() (+10 more)

### Community 102 - "engineering/README.md"
Cohesion: 0.20
Nodes (4): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу

### Community 103 - "resources.ts"
Cohesion: 0.13
Nodes (26): Connection, createAgentSessionStore(), reconciliationSchema, createArtifactRegistry(), createDeletionStore(), createDocumentIo(), createFactsStore(), createGenerationStore() (+18 more)

### Community 104 - "Работы, модели и заполнение документа"
Cohesion: 0.33
Nodes (6): Агентский контекст и данные, Локальный запуск и доказательства, Повторы визуального анализа, Полное удаление и восстановление, Постоянный контекст работы, Работы, модели и заполнение документа

### Community 105 - "app.ts"
Cohesion: 0.23
Nodes (9): createApp(), authRoutes(), DocumentHttpOptions, documentRoutes(), WorkHttpOptions, artifact(), DocumentError, createLogger() (+1 more)

### Community 106 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 107 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 108 - "work-detail.tsx"
Cohesion: 0.12
Nodes (16): active(), errors, journeySteps, newest(), Run, StepKey, stepOf(), workStage (+8 more)

### Community 109 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (8): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки, Владельцы и исполнение

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "build-windows-portable.mjs"
Cohesion: 0.33
Nodes (3): env, lock, root

### Community 112 - "api/client.ts"
Cohesion: 0.09
Nodes (17): dynamic, relay(), register(), HttpFetch, proxyApiRequest(), requestHeaders, responseHeaders, readServerConfig() (+9 more)

### Community 113 - "boundaries.test.ts"
Cohesion: 0.33
Nodes (4): cases, cli, config, root

### Community 114 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 115 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 116 - "templates/index.ts"
Cohesion: 0.10
Nodes (30): pack, paragraph(), GenerationFile, GenerationRecord, generateDocument(), bankruptcyPackage, historicalPackage, previousPackage (+22 more)

### Community 117 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 118 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "work-pipeline.md"
Cohesion: 0.22
Nodes (5): Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Бланки пакета банкротства, Подготовка следующей версии

### Community 122 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 124 - "routes/works.ts"
Cohesion: 0.22
Nodes (10): connections, workEventStream(), body(), id(), workRoutes(), WorkError, createWorkSchema, editWorkSchema (+2 more)

### Community 125 - "processing/index.ts"
Cohesion: 0.20
Nodes (6): ProcessingClaim, ProcessingStore, createProcessingService(), LlmConfiguration, LlmSettingsStore, createProcessingStore()

### Community 126 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 127 - "start-api.ts"
Cohesion: 0.33
Nodes (5): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi()

### Community 128 - "WorkList"
Cohesion: 0.25
Nodes (7): delays, stagger(), Filter, useListPreferences, Journey(), WorkList(), zustand

### Community 129 - "migrate-document-artifacts.ts"
Cohesion: 0.33
Nodes (5): db, env, legacy, locks, storage

### Community 130 - "stage-windows-infrastructure.mjs"
Cohesion: 0.40
Nodes (3): downloads, output, sources

### Community 131 - "Локальный stateless MinerU"
Cohesion: 0.50
Nodes (4): Контракт процессора, Локальный stateless MinerU, Проверка, Хранение и полное удаление

### Community 133 - "work-ports.ts"
Cohesion: 0.50
Nodes (3): StepOutput, stepOutputSchema, WorkRunRecord

## Knowledge Gaps
- **91 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 985 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkView` connect `WorkApi` to `works/ports.ts`, `Button`, `work-review.tsx`, `work-ports.ts`, `works.test.ts`, `work-pipeline.tsx`, `work-detail.tsx`, `templates/index.ts`, `src/works.ts`, `work-sources.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `Работы, модели и заполнение документа` connect `Работы, модели и заполнение документа` to `work-pipeline.md`, `Данные, доступ и фоновые задания`, `WorkApi`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Why does `HTTP, SSE и настройки` connect `WorkApi` to `Работы, модели и заполнение документа`, `Данные, доступ и фоновые задания`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `ref_bun_test` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._