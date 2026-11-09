# Graph Report - anyko  (2026-11-09)

## Corpus Check
- 311 files · ~175,914 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 4)

## Summary
- 1860 nodes · 3700 edges · 124 communities (104 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88444da6`
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
- document-viewer.tsx
- Runtime и диагностика
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- diagnostic-worker.test.ts
- backend/tsconfig.json
- logger/tsconfig.json
- access.test.ts
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- Button
- src/works.ts
- llm/package.json
- modules/documents/index.ts
- documents.test.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- smoke.py
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
- resources.ts
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
- OwnedPostgres
- stage-windows-mineru.mjs
- layout.tsx
- works/ports.ts
- GenerationStore
- WorkProcessingStore
- work-review.tsx
- Feature-based web и модульный backend с ports/adapters
- ModelHandler
- assets/README.md
- bootstrap.mjs
- Направления развития Anyko
- work-detail.tsx
- llm/tsconfig.json
- build-windows-portable.mjs
- api/client.ts
- boundaries.test.ts
- Anyko
- execute.ts
- Размещение основы в Dokploy
- stage-windows-web.mjs
- Agent skills
- engineering/README.md
- Работа агентов и независимая проверка
- build-windows-web.mjs
- contracts/src/index.ts
- result-preview.tsx
- migrate-document-artifacts.ts

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
- `startApi()` --calls--> `createS3Storage()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/modules/documents/infrastructure/s3-storage.ts
- `startApi()` --calls--> `createDocumentRuntime()`  [EXTRACTED]
  apps/api/src/bootstrap/start-api.ts → packages/backend/src/runtime/documents/api.ts

## Import Cycles
- None detected.

## Communities (124 total, 20 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.12
Nodes (16): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+8 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (39): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3 (+31 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.16
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

### Community 9 - "launcher.py"
Cohesion: 0.12
Nodes (18): allow_restricted_user(), BasicLimits, command(), create_job(), create_mutex(), ExtendedLimits, initialize_database(), invoke() (+10 more)

### Community 10 - "read-logs.py"
Cohesion: 0.23
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "work-pipeline.tsx"
Cohesion: 0.11
Nodes (31): Disclosure(), absolute, formatRelative(), relative, RelativeTime(), units, Spinner(), icons (+23 more)

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
Cohesion: 0.31
Nodes (3): main(), port(), ready()

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Язык Anyko"
Cohesion: 0.40
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 27 - "workspace.tsx"
Cohesion: 0.17
Nodes (15): AppShell(), Logo(), DocumentsPage(), HomePage(), WorkPage(), Workspace(), CosmicBackground(), EventHorizon() (+7 more)

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

### Community 37 - "document-viewer.tsx"
Cohesion: 0.14
Nodes (18): navigation, buttonStyles(), Size, sizes, Variant, variants, Modal(), SegmentedControl() (+10 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

### Community 41 - "processor.py"
Cohesion: 0.10
Nodes (4): erase(), health(), parse(), VisualExportReview

### Community 42 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @anyko/contracts, @anyko/logger, @base-ui/react, katex, lucide-react, next, react (+11 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "diagnostic-worker.test.ts"
Cohesion: 0.14
Nodes (10): resultSchema, runDiagnostic(), envelope, State, logger, fields, LogEvent, LogLevel (+2 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "access.test.ts"
Cohesion: 0.06
Nodes (34): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi(), createApp(), authRoutes(), DocumentHttpOptions (+26 more)

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "stage-windows-release.mjs"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "Button"
Cohesion: 0.16
Nodes (21): Button(), Confirm(), DropZone(), Flying, orbits, fileExtension(), FileIcon(), HoverMist() (+13 more)

### Community 52 - "src/works.ts"
Cohesion: 0.07
Nodes (28): DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema, previewCellSchema, PreviewParagraph (+20 more)

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
Cohesion: 0.11
Nodes (16): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+8 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

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
Cohesion: 0.13
Nodes (16): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), connectionSchema (+8 more)

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

### Community 77 - "resources.ts"
Cohesion: 0.10
Nodes (29): createAgentSessionStore(), createArtifactRegistry(), Connection, createDocumentCommands(), Registration, createDocumentIo(), createDocumentReadModel(), statusSchema (+21 more)

### Community 78 - "WorkStore"
Cohesion: 0.07
Nodes (16): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки, HTTP, SSE и настройки (+8 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.33
Nodes (10): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken(), permissions, readResponse(), request() (+2 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "Защита GitHub"
Cohesion: 0.29
Nodes (6): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, check()

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "check-project.mjs"
Cohesion: 0.15
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "work-list.tsx"
Cohesion: 0.23
Nodes (12): FormField(), Input(), Skeleton(), delays, stagger(), SignIn(), Filter, useListPreferences (+4 more)

### Community 87 - "runtime/index.ts"
Cohesion: 0.13
Nodes (16): documentsSchema, parseWorkerConfig(), schema, startWorker(), createMineruParser(), createS3Storage(), createWorkerRuntime(), createDocumentWorker() (+8 more)

### Community 88 - "facts/index.ts"
Cohesion: 0.19
Nodes (15): confirmFacts(), editFacts(), emptyFacts(), FactsStore, findFactConflicts(), mergeCandidates(), reconcile(), stable() (+7 more)

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 90 - "works/ports.ts"
Cohesion: 0.15
Nodes (6): DocumentService, LlmSettingsStore, WorkRuntimeOptions, WorkDependencies, WorkStores, Logger

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.15
Nodes (11): createDeletionStore(), ProcessingClaim, ProcessingStore, createProcessingService(), LlmConfiguration, createProcessingStore(), envelope, createDocumentDeletionWorkflow() (+3 more)

### Community 93 - "ref_node_fs"
Cohesion: 0.11
Nodes (10): { existsSync, readdirSync }, knownModules, moduleEdges, links, marker, downloads, output, sources (+2 more)

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.15
Nodes (8): descendant_handles(), initdb_diagnostic(), request(), start(), child(), dead(), main(), supervisor()

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "layout.tsx"
Cohesion: 0.28
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 98 - "works/ports.ts"
Cohesion: 0.11
Nodes (16): AgentDocument, AgentUsage, DocumentAgents, Connection, AgentSessionStore, combineCandidates(), Reconciliation, reconciliationSchema (+8 more)

### Community 100 - "WorkProcessingStore"
Cohesion: 0.09
Nodes (6): StepOutput, stepOutputSchema, WorkProcessingStore, Connection, kindSchema, workRunSchema

### Community 101 - "work-review.tsx"
Cohesion: 0.20
Nodes (18): fieldSurface, mentions(), PackagePreview(), Props, zooms, CandidateValue(), FieldEditor(), TextSlot() (+10 more)

### Community 102 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 106 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 107 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 108 - "work-detail.tsx"
Cohesion: 0.10
Nodes (21): config, active(), conflictingFields(), errors, journeySteps, newest(), Run, StepKey (+13 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "build-windows-portable.mjs"
Cohesion: 0.33
Nodes (3): env, lock, root

### Community 112 - "api/client.ts"
Cohesion: 0.09
Nodes (15): dynamic, relay(), register(), HttpFetch, proxyApiRequest(), requestHeaders, responseHeaders, readServerConfig() (+7 more)

### Community 113 - "boundaries.test.ts"
Cohesion: 0.33
Nodes (4): cases, cli, config, root

### Community 114 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 116 - "execute.ts"
Cohesion: 0.20
Nodes (13): generateDocument(), WorkRunRecord, createWorkWorker(), envelope, createWorkCleanup(), ContinuationSource, createWorkContinuation(), createWorkExecution() (+5 more)

### Community 117 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 118 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "engineering/README.md"
Cohesion: 0.16
Nodes (7): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток

### Community 122 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 125 - "contracts/src/index.ts"
Cohesion: 0.10
Nodes (24): pack, paragraph(), GenerationFile, GenerationRecord, bankruptcyPackage, historicalPackage, previousPackage, templateBytes() (+16 more)

### Community 126 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 129 - "migrate-document-artifacts.ts"
Cohesion: 0.20
Nodes (7): StorageWriteOutcomeUnknown, put(), db, env, legacy, locks, storage

## Knowledge Gaps
- **91 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 991 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Работы, модели и заполнение документа` connect `WorkStore` to `engineering/README.md`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `HTTP, SSE и настройки` connect `WorkStore` to `access.test.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `MVP: автоматизация подготовки заявления о банкротстве физического лица` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._