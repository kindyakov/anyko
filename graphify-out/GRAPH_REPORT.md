# Graph Report - issue-31-fact-discrepancy  (2026-11-18)

## Corpus Check
- 715 files · ~311,632 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 7, .ttf 5, .example 4)

## Summary
- 3969 nodes · 9790 edges · 215 communities (183 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 244 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `704d75d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- run-local.test.mjs
- work-screen.tsx
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- ref_react
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- launcher.py
- json
- api-design.test.ts
- api/package.json
- agents/domain.md
- agents/triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- Issue tracker: GitHub
- start-api.ts
- exports
- web/tsconfig.json
- Button
- Проверка качества
- Process
- idempotency/index.ts
- logger/package.json
- app-shell.tsx
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- documents/endpoints.ts
- WorkspaceScope
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- call.ts
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- database/src/index.ts
- isolation.test.ts
- llm/package.json
- work-store.ts
- works/schemas.ts
- Issue tracker: GitHub
- MinerU и RouterAI: граница совместимости
- Инженерная основа Anyko
- engineering/README.md
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- portable_shutdown.py
- mastra.ts
- dependencies
- database/README.md
- .run
- devDependencies
- document-workspace.tsx
- job-host.test.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- .require
- agent-github.mjs
- api/errors.ts
- boundaries.test.ts
- Размещение и эксплуатация
- stage-windows-migrator.mjs
- WorkProcessingStore
- dev.mjs
- devDependencies
- logger/src/index.ts
- routes/works/index.ts
- Anyko
- teach/SKILL.md
- LogReaderTests
- Tx
- Runtime и диагностика
- smoke-windows-release.py
- Codebase Design
- stage-windows-mineru.mjs
- ref_bun_test
- agents/index.ts
- Anyko — брендбук
- jobs/index.ts
- http/route.ts
- works/api/mutations.ts
- Database
- mineru.ts
- exports
- ref_lucide_react
- facts-form.test.tsx
- start.ts
- tests/route.test.ts
- llm/tsconfig.json
- ref_zod
- dependencies.md
- Решение
- modules/documents/index.ts
- DocumentStore
- transactions/index.ts
- workspace-states.tsx
- Примеры v2
- Agent skills
- During the session
- session-gate.ts
- build-windows-web.mjs
- document-deletion.test.ts
- deep-sky.ts
- HTML Report Format
- endpoint.ts
- templates/schemas.ts
- read-source.ts
- fields.tsx
- template.sh
- works.test.ts
- work-list.test.tsx
- Ask Matt
- documents.test.ts
- Diagnosing Bugs
- ui/package.json
- Язык Anyko
- document-viewer.tsx
- result-preview.tsx
- Работа агентов и независимая проверка
- Данные, доступ и фоновые задания
- Test-Driven Development
- connections/endpoints.ts
- check-project.mjs
- documents/module.ts
- Process
- eslint.config.mjs
- templates/index.ts
- writing-for-agents/SKILL.md
- modules/connections/index.ts
- @tanstack/react-query
- runtime/index.ts
- setup.ts
- Решение
- values.ts
- sha256Hex
- pdf_ocr.py
- server/config.ts
- wayfinder/SKILL.md
- edit-values.test.ts
- work-list.test.tsx
- build-windows-portable.mjs
- FakeEventSource
- to-spec/SKILL.md
- black-hole-renderer.ts
- DocumentId
- Triage
- ui/src/index.ts
- Направления развития Anyko
- scroll-sync.ts
- ref_node_fs
- e2e/tsconfig.json
- DeliveryPort
- runtime/jobs.ts
- job-host.test.ts
- ui/tsconfig.json
- assets/README.md
- PdfRecoveryReview
- Process
- <Questionnaire title>
- server/session.test.ts
- Размещение основы в Dokploy
- Process
- Principles
- Out-of-Scope Knowledge Base
- Examples
- stage-windows-web.mjs
- Каталог HTTP API
- bootstrap.mjs
- Sections
- job-scope.ts
- WorkDeletionStore
- Серверная часть
- ProcessorReview
- VisualExportReview
- startJobWorker
- journey.test.ts
- generation/index.ts
- hitl-loop.template.sh
- GLOSSARY.md Format
- implement-spec/SKILL.md
- CREDITS.md
- paintBlackHole
- startBlackHole
- Feature-based web и модульный backend с ports/adapters
- .render

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 99 edges
2. `createBackend()` - 85 edges
3. `Button()` - 66 edges
4. `scripts` - 64 edges
5. `WorkId` - 52 edges
6. `Tx` - 42 edges
7. `callApi()` - 38 edges
8. `@tanstack/react-query` - 37 edges
9. `createLogger()` - 36 edges
10. `WorksModule` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Повтор команд и журнал действий` --references--> `provisionLocalAccess()`  [INFERRED]
  docs/engineering/backend.md → packages/backend/src/modules/access/infrastructure/auth.ts
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `Единые таблицы запусков` --references--> `ProcessingIo`  [INFERRED]
  docs/engineering/data-and-jobs.md → packages/backend/src/modules/processing/application/io.ts
- `Правила зависимостей` --references--> `Tx`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/platform/transactions/index.ts
- `Композиция процесса` --references--> `createBackend()`  [INFERRED]
  docs/adr/0009-backend-architecture.md → packages/backend/src/runtime/create-backend.ts

## Import Cycles
- None detected.

## Communities (215 total, 32 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "run-local.test.mjs"
Cohesion: 0.13
Nodes (15): hook, root, createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root (+7 more)

### Community 3 - "work-screen.tsx"
Cohesion: 0.08
Nodes (50): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), fail() (+42 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "ref_react"
Cohesion: 0.08
Nodes (50): conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), allKeys(), FactValues, sameFieldValue(), sameFieldValues() (+42 more)

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
Cohesion: 0.09
Nodes (20): allow_restricted_user(), BasicLimits, command(), create_job(), create_mutex(), ExtendedLimits, initialize_database(), invoke() (+12 more)

### Community 10 - "json"
Cohesion: 0.19
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "api-design.test.ts"
Cohesion: 0.08
Nodes (29): actions, address(), boundedDirectories, collections, declaredOverlaps, entries, Entry, globals (+21 more)

### Community 12 - "api/package.json"
Cohesion: 0.08
Nodes (25): dependencies, @anyko/backend, @anyko/logger, elysia, zod, devDependencies, @anyko/typescript-config, @types/bun (+17 more)

### Community 15 - "worker/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @anyko/backend, @anyko/logger, bullmq, ioredis, zod, devDependencies, @anyko/typescript-config (+23 more)

### Community 16 - "eslint-config/package.json"
Cohesion: 0.09
Nodes (22): exports, ./base, ./frontend, ./server, eslint, @eslint/js, eslint-plugin-jsx-a11y-x, eslint-plugin-react-hooks (+14 more)

### Community 17 - "scripts"
Cohesion: 0.03
Nodes (64): scripts, access:provision-local, agent:github, api:catalog, artifacts:migrate, boundaries, build, build:windows (+56 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "start-api.ts"
Cohesion: 0.14
Nodes (14): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), BackendConfigError, BackendConfigErrorCode, backendConfigSchema (+6 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "Button"
Cohesion: 0.11
Nodes (29): WorkListPage(), useCreateWork(), documentPackagesQueryOptions(), worksQueryOptions(), readWorkListParams(), workListHref(), WorkListParams, WorkListView (+21 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Process"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.08
Nodes (32): memoryIdempotency(), Row, AcquireInput, AcquireOutcome, IdempotencyKeyRef, IdempotencyStore, StoredResponse, IdempotencyDeps (+24 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "app-shell.tsx"
Cohesion: 0.11
Nodes (29): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), WorkspaceLayout() (+21 more)

### Community 31 - "knip.json"
Cohesion: 0.15
Nodes (12): entry, ignoreDependencies, ignore, ignoreBinaries, entry, ignore, ignoreDependencies, $schema (+4 more)

### Community 33 - "server.json"
Cohesion: 0.40
Nodes (4): compilerOptions, types, extends, ./base.json

### Community 34 - "api/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 36 - "worker/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 37 - "documents/endpoints.ts"
Cohesion: 0.13
Nodes (18): documentSummary(), cursorResponseSchema(), deleteDocument, documentParams, getDocument, getDocumentDeletion, getDocumentImage, getDocumentResult (+10 more)

### Community 38 - "WorkspaceScope"
Cohesion: 0.08
Nodes (20): 3. Author the wizard, Доверенный scope и права, FactsCommands, attachDocument(), bumpRevision(), createWork(), findWork(), listEvents() (+12 more)

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.10
Nodes (13): appdata, bin, data, env, identity, infra, migrator, migratorSource (+5 more)

### Community 41 - "processor.py"
Cohesion: 0.07
Nodes (16): image_png(), media_entries(), prepare_docx(), replace_missing_visuals(), read_image_lines(), erase(), health(), parse() (+8 more)

### Community 42 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @anyko/contracts, @anyko/logger, @anyko/ui, @base-ui/react, docx-preview, katex, lucide-react (+14 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "backend/package.json"
Cohesion: 0.08
Nodes (23): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, @anyko/database, @anyko/llm, @anyko/logger (+15 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "call.ts"
Cohesion: 0.08
Nodes (31): Files(), Generation, generationTones, BodyField, CallArgs, CallOptions, encodeBody(), endpointUrl() (+23 more)

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "stage-windows-release.mjs"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.08
Nodes (24): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+16 more)

### Community 51 - "database/src/index.ts"
Cohesion: 0.10
Nodes (22): documentResultSchema, BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool() (+14 more)

### Community 52 - "isolation.test.ts"
Cohesion: 0.19
Nodes (12): access, member, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor(), scopeWith() (+4 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "work-store.ts"
Cohesion: 0.09
Nodes (34): agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), createDeletionStore(), createS3Storage(), createFactsStore(), factsStoreFor() (+26 more)

### Community 55 - "works/schemas.ts"
Cohesion: 0.05
Nodes (43): listDocumentPackages, fieldKeySchema, fieldValueSchema, fieldValuesSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema (+35 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "MinerU и RouterAI: граница совместимости"
Cohesion: 0.11
Nodes (17): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "engineering/README.md"
Cohesion: 0.16
Nodes (7): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток

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

### Community 64 - "portable_shutdown.py"
Cohesion: 0.15
Nodes (6): model_path(), valid_model(), install(), main(), port(), ready()

### Community 65 - "mastra.ts"
Cohesion: 0.14
Nodes (16): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), legacyFieldKeys (+8 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "document-workspace.tsx"
Cohesion: 0.09
Nodes (44): RecognitionPage(), revokeConnection(), RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument() (+36 more)

### Community 73 - "job-host.test.ts"
Cohesion: 0.19
Nodes (16): createDocumentCommands(), createDocumentReadModel(), legacyPdf(), view(), nextRunRevision(), Connection, createProcessingCommands(), start() (+8 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "facts/index.ts"
Cohesion: 0.13
Nodes (21): acceptRunCandidates(), Candidate, ref, runFacts(), confirmValues(), editValues(), readAnalysisFacts(), readFacts() (+13 more)

### Community 78 - ".require"
Cohesion: 0.11
Nodes (40): works, Проектирование адресов, listWorks(), WorkDeletion, WorkError, WorkListPage, WorkSearch, WorkSourceRow (+32 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "api/errors.ts"
Cohesion: 0.12
Nodes (16): uploadTexts, HttpFetch, request(), requestApi(), requestApiFile(), RequestOptions, failWith(), ApiError (+8 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "WorkProcessingStore"
Cohesion: 0.06
Nodes (22): Единый механизм запусков, Выкат #22 в окно обслуживания, Выкат заданий и очередей, IoSubject, ProcessingIo, isActive(), listRuns(), startRun() (+14 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.16
Nodes (12): createApp(), Analyze, appWith(), logger, memberAccess, memberSession, stubHttpOptions(), unused() (+4 more)

### Community 88 - "routes/works/index.ts"
Cohesion: 0.15
Nodes (21): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), workEventStream(), presentWork(), worksRoutes(), Sent (+13 more)

### Community 89 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 90 - "teach/SKILL.md"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "Tx"
Cohesion: 0.13
Nodes (22): Connection, lockLiveDocumentForResponse(), Registration, generationFileSchema, generationSchema, Connection, createIdempotencyStore(), idempotencyStoreFor() (+14 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.12
Nodes (9): descendant_handles(), initdb_diagnostic(), ModelHandler, request(), start(), child(), dead(), main() (+1 more)

### Community 95 - "Codebase Design"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "ref_bun_test"
Cohesion: 0.19
Nodes (18): renderWork(), source, result, Status, serveWork(), wrapperFor(), serveWork(), installEventSource() (+10 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.10
Nodes (14): Контрольные примеры для reviewer, AgentSessionStore, Reconciliation, reconciliationSchema, AgentDocument, AgentsPorts, AgentUsage, DocumentAgents (+6 more)

### Community 99 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (18): This is NOT the Next.js you know, Архитектура, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот (+10 more)

### Community 100 - "jobs/index.ts"
Cohesion: 0.14
Nodes (13): CommonDefinition, currentEnvelope, identity, JobDelivery, JobRegistry, RetryPolicy, RunDefinition, RunJob (+5 more)

### Community 101 - "http/route.ts"
Cohesion: 0.08
Nodes (32): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+24 more)

### Community 102 - "works/api/mutations.ts"
Cohesion: 0.14
Nodes (20): useWorkEvents(), WorkLive, documentPackageKeys, workKeys, CreateWorkInput, FactsDraft, useDeleteWork(), workDeletionQueryOptions() (+12 more)

### Community 103 - "Database"
Cohesion: 0.15
Nodes (17): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+9 more)

### Community 104 - "mineru.ts"
Cohesion: 0.13
Nodes (14): Artifact, DocumentPosition, DocumentResult, DocumentStatus, box, coordinate, pdfOcrSchema, SourceFormat (+6 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "ref_lucide_react"
Cohesion: 0.12
Nodes (23): analysisRuns(), groupSteps(), Run, runProgress(), Step, Run, Step, visionVisuals() (+15 more)

### Community 107 - "facts-form.test.tsx"
Cohesion: 0.13
Nodes (14): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+6 more)

### Community 108 - "start.ts"
Cohesion: 0.08
Nodes (27): AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid (+19 more)

### Community 109 - "tests/route.test.ts"
Cohesion: 0.10
Nodes (33): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+25 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "ref_zod"
Cohesion: 0.17
Nodes (10): agentSessionContextSchema, agentSessionSchema, factsSchema, candidateSchema, fieldKeySchema, fieldValueIssue(), fieldValueSchema, fieldValuesSchema (+2 more)

### Community 113 - "Решение"
Cohesion: 0.10
Nodes (22): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Ошибки (+14 more)

### Community 114 - "modules/documents/index.ts"
Cohesion: 0.11
Nodes (10): DocumentListInput, DocumentPage, DocumentDeletionStatus, DocumentImage, DocumentSourceFile, DocumentUploadInput, InternalDocumentRef, InternalUploadInput (+2 more)

### Community 115 - "DocumentStore"
Cohesion: 0.11
Nodes (5): failed, queued, store(), unused(), DocumentStore

### Community 116 - "transactions/index.ts"
Cohesion: 0.11
Nodes (36): ApiInput, AppOptions, ConnectionHttpOptions, DocumentHttpOptions, WorkHttpOptions, Как добавлять, Как проверяются правила, AgentsModule (+28 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 119 - "Примеры v2"
Cohesion: 0.16
Nodes (11): C1, C2, C3, C4, C5, C6, C7, C8 (+3 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "During the session"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "session-gate.ts"
Cohesion: 0.13
Nodes (14): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+6 more)

### Community 124 - "document-deletion.test.ts"
Cohesion: 0.12
Nodes (14): ArtifactRegistry, DocumentParser, createArtifactRegistry(), createProcessingService(), createProcessingIo(), StorageWriteOutcomeUnknown, createDocumentOcrWorkflow(), failureCodes (+6 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "HTML Report Format"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "endpoint.ts"
Cohesion: 0.08
Nodes (31): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+23 more)

### Community 128 - "templates/schemas.ts"
Cohesion: 0.08
Nodes (30): generateDocument(), availablePackages(), bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), templateData() (+22 more)

### Community 129 - "read-source.ts"
Cohesion: 0.24
Nodes (11): formats, imageContainerFormat(), isDocx(), matchesSourceFormat(), sourceContentTypes, sourceFormatFromKey(), startsWith(), contentTypes (+3 more)

### Community 130 - "fields.tsx"
Cohesion: 0.07
Nodes (41): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), connectionKeys (+33 more)

### Community 131 - "template.sh"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.07
Nodes (26): workspaceWithWork(), memberScope(), upload(), waitFor(), actualPool, agents, apiBackend, create() (+18 more)

### Community 133 - "work-list.test.tsx"
Cohesion: 0.21
Nodes (9): manrope, metadata, onest, RootLayout(), Providers(), renderWorkspace(), renderWorkList(), ToastProvider() (+1 more)

### Community 134 - "Ask Matt"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "documents.test.ts"
Cohesion: 0.10
Nodes (15): SourceStorage, createSourceCleanup(), startDocumentWorker(), api, contentTypes, db, files, logger (+7 more)

### Community 136 - "Diagnosing Bugs"
Cohesion: 0.13
Nodes (14): Completion criterion: a tight loop that goes red, Diagnosing Bugs, Minimise, Non-deterministic bugs, Phase 1: Build a feedback loop, Phase 2: Reproduce + minimise, Phase 3: Hypothesise, Phase 4: Instrument (+6 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "document-viewer.tsx"
Cohesion: 0.12
Nodes (28): WorkNotFound(), DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), recognitionRetryText, documentKind(), DocumentOriginal(), documentLinks() (+20 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "Данные, доступ и фоновые задания"
Cohesion: 0.20
Nodes (10): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Единые таблицы запусков, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание (+2 more)

### Community 143 - "Test-Driven Development"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "connections/endpoints.ts"
Cohesion: 0.10
Nodes (18): json(), ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, getLlmSettings, revokeLlmSettings, saveLlmSettings (+10 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.17
Nodes (12): contractModules, describedEndpoints(), namedEndpoints(), isEndpoint(), apiCatalogIsCurrent(), catalogFile, renderApiCatalog(), documents (+4 more)

### Community 146 - "documents/module.ts"
Cohesion: 0.23
Nodes (15): listDocuments(), readPosition(), listPendingDeletions(), DocumentDeps, readArtifact(), readDeletion(), readDocument(), readImage() (+7 more)

### Community 147 - "Process"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "eslint.config.mjs"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "templates/index.ts"
Cohesion: 0.17
Nodes (20): DocumentAnalysis, WorkRunRecord, requirePackage(), failureOf(), WorkSummary, isAppError(), ContinuationSource, createWorkContinuation() (+12 more)

### Community 150 - "writing-for-agents/SKILL.md"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "modules/connections/index.ts"
Cohesion: 0.20
Nodes (9): AuditModule, input, currentConnection(), LlmSettingsStore, revokeConnection(), persistConnection(), saveConnection(), createConnectionsModule() (+1 more)

### Community 152 - "@tanstack/react-query"
Cohesion: 0.13
Nodes (22): renderShell(), user, session, configured, json(), renderSettings(), serveSaveAnswer(), serveSettings() (+14 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.05
Nodes (32): BackendConfig, connectionApi(), db, encryptionKey, owned, pool, settingsBackends, users (+24 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "values.ts"
Cohesion: 0.14
Nodes (27): comparableFactValue(), confirmFacts(), editFacts(), findFactDiscrepancies(), includesFactValue(), markSelectedCandidates(), mergeCandidates(), reconcile() (+19 more)

### Community 158 - "sha256Hex"
Cohesion: 0.33
Nodes (6): readAnalysis(), canonicalize(), fingerprintInput(), ADR-0009, sha256Hex(), ADR-0009

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "server/config.ts"
Cohesion: 0.19
Nodes (8): dynamic, relay(), register(), proxyApiRequest(), readServerConfig(), schema, HttpMethod, server-only

### Community 161 - "wayfinder/SKILL.md"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - "edit-values.test.ts"
Cohesion: 0.25
Nodes (10): editValues(), failureOf(), ports(), scenario(), unused(), unusedFactsInternal, unusedWorkInternal, work (+2 more)

### Community 163 - "work-list.test.tsx"
Cohesion: 0.17
Nodes (9): createdWorkView, existingWork, json(), packages, serveWorkList(), template, expectFocused(), react-dom (+1 more)

### Community 164 - "build-windows-portable.mjs"
Cohesion: 0.33
Nodes (3): env, lock, root

### Community 166 - "to-spec/SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.28
Nodes (4): DiskProjection, HoleFrame, createGalaxyRenderer(), createLensedSky()

### Community 168 - "DocumentId"
Cohesion: 0.22
Nodes (5): DocumentView, DocumentsCommands, DocumentsInternal, DocumentsQueries, DocumentId

### Community 169 - "Triage"
Cohesion: 0.22
Nodes (9): Invocation, Needs-info template, Quick state override, Reference docs, Resuming a previous session, Roles, Show what needs attention, Triage (+1 more)

### Community 170 - "ui/src/index.ts"
Cohesion: 0.08
Nodes (27): filePlural, Flying, orbits, HorizonState, moods, Size, sizes, Variant (+19 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "scroll-sync.ts"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 173 - "ref_node_fs"
Cohesion: 0.07
Nodes (19): config, assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, links (+11 more)

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 176 - "runtime/jobs.ts"
Cohesion: 0.37
Nodes (8): idempotencyCleanupJob(), defineJob(), createJobRegistry(), documentMaintenanceJob(), documentOcrJob(), workAnalysisJob(), workGenerationJob(), workMaintenanceJob()

### Community 177 - "job-host.test.ts"
Cohesion: 0.11
Nodes (14): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime(), envelope (+6 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 181 - "Process"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "<Questionnaire title>"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 184 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 185 - "Process"
Cohesion: 0.33
Nodes (5): 1. Scope the procedure, 2. Map each stage's journey, 4. Verify and hand off, Process, Wizard

### Community 187 - "Principles"
Cohesion: 0.29
Nodes (8): Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Explicit scope boundaries, Principles, paint(), schedule(), tick()

### Community 188 - "Out-of-Scope Knowledge Base"
Cohesion: 0.29
Nodes (4): Directory structure, File format, Out-of-Scope Knowledge Base, Prior requests

### Community 189 - "Examples"
Cohesion: 0.29
Nodes (7): Bad agent brief, Examples, Good agent brief (bug), Good agent brief (enhancement), Good agent brief (PR), Template, Writing Agent Briefs

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Каталог HTTP API"
Cohesion: 0.40
Nodes (5): catalog, connections, documents, session, Каталог HTTP API

### Community 192 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 193 - "Sections"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 195 - "job-scope.ts"
Cohesion: 0.33
Nodes (6): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, issueExecutionScope()

### Community 197 - "Серверная часть"
Cohesion: 0.20
Nodes (10): GET(), LlmSettings, Модуль, Ошибки, Повтор команд и журнал действий, Подключение модели, Серверная часть, Структура (+2 more)

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 200 - "startJobWorker"
Cohesion: 0.18
Nodes (11): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Задания, JobRuntime, parseJobEnvelope(), parseWorkerQueues() (+3 more)

### Community 202 - "generation/index.ts"
Cohesion: 0.11
Nodes (14): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationQueries, GenerationRecord (+6 more)

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 214 - "paintBlackHole"
Cohesion: 0.47
Nodes (5): paintBlackHole(), annulus(), disk(), drawSpacecraft(), project()

### Community 216 - "startBlackHole"
Cohesion: 0.53
Nodes (4): startBlackHole(), paint(), tick(), visibility()

### Community 217 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1766 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `Серверная часть`, `routes/works/index.ts`, `MinerU и RouterAI: граница совместимости`, `LogReaderTests`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `session-gate.ts` to `package.json`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._