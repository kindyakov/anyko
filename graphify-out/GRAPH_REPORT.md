# Graph Report - anyko  (2026-11-08)

## Corpus Check
- 272 files · ~135,383 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: (none) 5, .ttf 5, .example 4)

## Summary
- 1547 nodes · 2932 edges · 110 communities (94 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `079f585d`
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
- start-api.ts
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- start-worker.ts
- architecture.js
- exports
- web/tsconfig.json
- backend/package.json
- Проверка качества
- engineering/README.md
- works.test.ts
- logger/package.json
- startBlackHole
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- work-detail.tsx
- Runtime и диагностика
- library.json
- routes/works.ts
- processor.py
- dependencies
- architecture/tsconfig.json
- templates/index.ts
- backend/tsconfig.json
- logger/tsconfig.json
- WorkApi
- database/package.json
- database/src/index.ts
- contracts/package.json
- access.test.ts
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
- ref_zod
- dependencies
- database/README.md
- Processor
- devDependencies
- Размещение основы в Dokploy
- contracts/src/index.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- DocumentAgents
- Работа агентов и независимая проверка
- agent-github.mjs
- ProcessorReview
- ref_node_path
- DocumentStore
- logger/src/index.ts
- check-project.mjs
- dev.mjs
- migrate-document-artifacts.ts
- result-preview.tsx
- facts/index.ts
- Размещение и эксплуатация
- execute.ts
- LogReaderTests
- document-deletion.test.ts
- ref_node_fs
- smoke.py
- exports
- diagnostic-worker.test.ts
- devDependencies
- document-packages.ts
- works/ports.ts
- WorkProcessingStore
- architecture.md
- resources.ts
- Направления развития Anyko
- Anyko
- llm/tsconfig.json
- VisualExportReview
- route.ts
- WorkStore
- review-cases/README.md

## God Nodes (most connected - your core abstractions)
1. `scripts` - 41 edges
2. `WorkProcessingStore` - 23 edges
3. `requestApi()` - 22 edges
4. `SourceStorage` - 20 edges
5. `react` - 19 edges
6. `Workspace()` - 19 edges
7. `createDocumentWorker()` - 19 edges
8. `DocumentStore` - 18 edges
9. `createWorkRuntime()` - 18 edges
10. `Database` - 18 edges

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

## Communities (110 total, 16 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.12
Nodes (15): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @types/bun, typescript, @typescript/native, zod, name (+7 more)

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
Cohesion: 0.25
Nodes (8): C1, C2, C3, C4, C5, C6, C7, Примеры v1

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

### Community 11 - "start-api.ts"
Cohesion: 0.33
Nodes (5): parseApiConfig(), schema, parseDocumentConfig(), schema, startApi()

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

### Community 20 - "start-worker.ts"
Cohesion: 0.17
Nodes (10): documentsSchema, parseWorkerConfig(), schema, startWorker(), createMineruParser(), createS3Storage(), createWorkerRuntime(), flag (+2 more)

### Community 21 - "architecture.js"
Cohesion: 0.24
Nodes (3): architectureRules, ioGlobals, restrictedIoGlobals

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "backend/package.json"
Cohesion: 0.11
Nodes (17): @anyko/contracts, @anyko/database, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, @types/bun, typescript, @typescript/native (+9 more)

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "engineering/README.md"
Cohesion: 0.23
Nodes (3): graphify, Бланки пакета банкротства, Подготовка следующей версии

### Community 27 - "works.test.ts"
Cohesion: 0.09
Nodes (18): createWorkWorker(), envelope, createWorkCleanup(), agents, analyze(), create(), db, files (+10 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "startBlackHole"
Cohesion: 0.21
Nodes (8): startBlackHole(), paint(), annulus(), disk(), project(), tick(), visibility(), createLensedSky()

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

### Community 37 - "work-detail.tsx"
Cohesion: 0.05
Nodes (74): config, DocumentsPage(), manrope, metadata, onest, RootLayout(), HomePage(), Providers() (+66 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "routes/works.ts"
Cohesion: 0.20
Nodes (14): createApp(), authRoutes(), DocumentHttpOptions, documentRoutes(), connections, workEventStream(), body(), id() (+6 more)

### Community 41 - "processor.py"
Cohesion: 0.13
Nodes (3): erase(), health(), parse()

### Community 42 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, @anyko/contracts, @anyko/logger, @base-ui/react, katex, lucide-react, next, next-themes (+12 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "templates/index.ts"
Cohesion: 0.17
Nodes (12): pack, paragraph(), bankruptcyPackage, historicalPackage, previousPackage, bytes, requireTemplate(), technicalBytes() (+4 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "WorkApi"
Cohesion: 0.12
Nodes (6): HTTP, SSE и настройки, GenerationRecord, WorkApi, FieldValues, WorkPage, WorkView

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "database/src/index.ts"
Cohesion: 0.22
Nodes (8): createDocumentCommands(), createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands(), Start, createDocumentUnitOfWork()

### Community 50 - "contracts/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 51 - "access.test.ts"
Cohesion: 0.16
Nodes (11): AccessOptions, buildAuth(), createAccess(), provisionLocalAccess(), llmSettingsResponseSchema, better-auth, @better-auth/prisma-adapter, config (+3 more)

### Community 52 - "src/works.ts"
Cohesion: 0.07
Nodes (29): DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema, previewCellSchema, PreviewParagraph (+21 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "modules/documents/index.ts"
Cohesion: 0.10
Nodes (27): checksum(), Artifact, ArtifactRegistry, DocumentIo, DocumentParser, DocumentResult, DocumentStatus, DocumentView (+19 more)

### Community 55 - "documents.test.ts"
Cohesion: 0.14
Nodes (9): contentTypes, db, files, logger, owned, pdf, runtime, storage (+1 more)

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

### Community 65 - "ref_zod"
Cohesion: 0.15
Nodes (15): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), connectionSchema (+7 more)

### Community 66 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+9 more)

### Community 71 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, @anyko/typescript-config, tailwindcss, @tailwindcss/postcss, @types/bun, @types/node, @types/react, @types/react-dom (+2 more)

### Community 72 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 73 - "contracts/src/index.ts"
Cohesion: 0.19
Nodes (8): GenerationFile, generateDocument(), healthResponseSchema, httpErrorSchema, Session, sessionResponseSchema, pizzip, config

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
Cohesion: 0.18
Nodes (6): DocumentAgents, FactsStore, WorkRuntimeOptions, FieldDefinition, WorkFacts, ModelConnection

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

### Community 83 - "logger/src/index.ts"
Cohesion: 0.32
Nodes (4): createLogger(), fields, LogEvent, LogLevel

### Community 84 - "check-project.mjs"
Cohesion: 0.22
Nodes (5): documents, errors, manifests, markdownFiles(), root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "migrate-document-artifacts.ts"
Cohesion: 0.15
Nodes (8): StorageWriteOutcomeUnknown, put(), db, env, legacy, locks, storage, parsed

### Community 87 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 88 - "facts/index.ts"
Cohesion: 0.23
Nodes (15): confirmFacts(), editFacts(), emptyFacts(), findFactConflicts(), mergeCandidates(), reconcile(), stable(), availablePackages() (+7 more)

### Community 89 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 90 - "execute.ts"
Cohesion: 0.13
Nodes (17): LlmConfiguration, LlmSettingsStore, StepOutput, stepOutputSchema, WorkRunRecord, Connection, kindSchema, templateBytes() (+9 more)

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.13
Nodes (16): createArtifactRegistry(), createDeletionStore(), createSourceCleanup(), ProcessingClaim, ProcessingStore, createProcessingService(), createProcessingStore(), finishDocumentDeletion() (+8 more)

### Community 93 - "ref_node_fs"
Cohesion: 0.20
Nodes (6): { existsSync, readdirSync }, knownModules, moduleEdges, hook, root, result

### Community 95 - "exports"
Cohesion: 0.33
Nodes (6): exports, ./access, ./documents, ./processing, ./runtime, ./works

### Community 96 - "diagnostic-worker.test.ts"
Cohesion: 0.17
Nodes (7): resultSchema, runDiagnostic(), envelope, State, logger, bullmq, ioredis

### Community 97 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 98 - "document-packages.ts"
Cohesion: 0.15
Nodes (14): Контрольные примеры для reviewer, AgentDocument, AgentUsage, Connection, AgentSessionStore, combineCandidates(), Reconciliation, reconciliationSchema (+6 more)

### Community 99 - "works/ports.ts"
Cohesion: 0.11
Nodes (5): SourceStorage, DocumentService, GenerationStore, WorkDependencies, WorkStores

### Community 100 - "WorkProcessingStore"
Cohesion: 0.09
Nodes (7): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, WorkProcessingStore, check()

### Community 102 - "architecture.md"
Cohesion: 0.12
Nodes (11): Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия (+3 more)

### Community 103 - "resources.ts"
Cohesion: 0.13
Nodes (22): createAgentSessionStore(), createDocumentIo(), createFactsStore(), createGenerationStore(), createLlmSettingsStore(), createWorkProcessingStore(), Connection, createWorkStore() (+14 more)

### Community 107 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 108 - "Anyko"
Cohesion: 0.67
Nodes (3): Anyko, Запуск и диагностика, Разработка каркаса

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 112 - "route.ts"
Cohesion: 0.21
Nodes (7): dynamic, relay(), register(), proxyApiRequest(), readServerConfig(), schema, server-only

### Community 113 - "WorkStore"
Cohesion: 0.08
Nodes (15): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки, Агентский контекст и данные (+7 more)

## Knowledge Gaps
- **91 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 833 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Работы, модели и заполнение документа` connect `WorkStore` to `engineering/README.md`, `WorkApi`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `Контрольные примеры для reviewer` connect `document-packages.ts` to `review-cases/README.md`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Why does `HTTP, SSE и настройки` connect `WorkApi` to `WorkStore`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._