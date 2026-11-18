# Graph Report - anyko  (2026-11-18)

## Corpus Check
- 657 files · ~275,199 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 3731 nodes · 9593 edges · 192 communities (163 shown, 29 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 234 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f1282ff`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- work-screen.tsx
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- src/works/index.ts
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- launcher.py
- read-logs.py
- api-design.test.ts
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- modules/works/index.ts
- infrastructure/auth.ts
- exports
- web/tsconfig.json
- ui/src/index.ts
- Проверка качества
- connection-settings.tsx
- idempotency/index.ts
- logger/package.json
- routes.ts
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- routes/documents/index.ts
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
- ids.ts
- llm/package.json
- job-host.test.ts
- ref_bun_test
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- AGENTS.md
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- portable_shutdown.py
- ref_zod
- dependencies
- database/README.md
- Processor
- devDependencies
- ref_react
- unit-of-work.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- WorksModule
- agent-github.mjs
- client.ts
- boundaries.test.ts
- ProcessingIo
- stage-windows-migrator.mjs
- WorkProcessingStore
- dev.mjs
- devDependencies
- logger/src/index.ts
- api/errors.ts
- architecture.md
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- transactionHandle
- Runtime и диагностика
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- mutations.test.tsx
- agents/index.ts
- prepare.ts
- runtime/jobs.ts
- http/route.ts
- documents/application/ports.ts
- edit-values.test.ts
- start-api.ts
- exports
- routes/works/index.ts
- facts-form.test.tsx
- start.ts
- app.ts
- llm/tsconfig.json
- bfl/fields.ts
- dependencies.md
- Решение
- catalog/schemas.ts
- DocumentStore
- openapi.ts
- workspace-states.tsx
- processing/index.ts
- Примеры v2
- Agent skills
- 202611170017_unified_processing/migration.sql
- session-gate.ts
- build-windows-web.mjs
- create-backend.ts
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- endpoint.ts
- templates/index.ts
- Feature-based web и модульный backend с ports/adapters
- connection-settings.tsx
- "AnykoWorkspace"
- works.test.ts
- "WorkGeneration"
- ui/package.json
- Язык Anyko
- document-viewer.tsx
- result-preview.tsx
- Работа агентов и независимая проверка
- Данные, доступ и фоновые задания
- 202611060012_work_agent_sessions/migration.sql
- connections/endpoints.ts
- check-project.mjs
- modules/documents/index.ts
- [file]/route.ts
- frontend.js
- work-analysis/index.ts
- "DocumentIo"
- modules/connections/index.ts
- createQueryClient
- runtime/index.ts
- setup.ts
- Решение
- automatic-value.ts
- Размещение и эксплуатация
- pdf_ocr.py
- createQueryClient
- RunDefinition
- smoke-windows-mineru.mjs
- src/session/index.ts
- FakeEventSource
- startBlackHole
- ref_node_path
- .dependency-cruiser.cjs
- src/works/index.ts
- Направления развития Anyko
- scroll-sync.ts
- bootstrap.mjs
- e2e/tsconfig.json
- DeliveryPort
- diagnostic-worker.test.ts
- start-worker.ts
- ui/tsconfig.json
- Anyko
- .test_two_matching_readings_preserve_number_and_a_conflict_is_excluded
- Размещение основы в Dokploy
- devDependencies
- stage-windows-web.mjs
- Каталог HTTP API
- work-pipeline.tsx
- ExecutionScope
- scripts
- ProcessorReview
- VisualExportReview
- startJobWorker
- prepare-storage.ts

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

## Communities (192 total, 29 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.17
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "work-screen.tsx"
Cohesion: 0.14
Nodes (25): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), fail() (+17 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "src/works/index.ts"
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

### Community 10 - "read-logs.py"
Cohesion: 0.19
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "api-design.test.ts"
Cohesion: 0.07
Nodes (30): actions, address(), boundedDirectories, collections, declaredOverlaps, entries, Entry, globals (+22 more)

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

### Community 20 - "modules/works/index.ts"
Cohesion: 0.08
Nodes (21): attachDocument(), bumpRevision(), createWork(), findWork(), listEvents(), listWorks(), readCursor(), readSources() (+13 more)

### Community 21 - "infrastructure/auth.ts"
Cohesion: 0.23
Nodes (12): authRoutes(), memberSession, ownerOnlyRights, rightsForRole(), AccessSession, scopeFor(), AccessOptions, buildAuth() (+4 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "ui/src/index.ts"
Cohesion: 0.07
Nodes (46): WorkListPage(), useCreateWork(), documentPackagesQueryOptions(), worksQueryOptions(), readWorkListParams(), workListHref(), WorkListParams, WorkListView (+38 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "connection-settings.tsx"
Cohesion: 0.12
Nodes (25): ConnectionsPage(), ShellFrame(), WorkspaceSwitcher(), WorkNotFound(), SignOut(), connectionKeys, LlmSettingsInput, useRevokeLlmSettings() (+17 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.09
Nodes (28): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, canonicalize(), fingerprintInput() (+20 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "routes.ts"
Cohesion: 0.13
Nodes (19): config, LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage() (+11 more)

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

### Community 37 - "routes/documents/index.ts"
Cohesion: 0.09
Nodes (28): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), documentSummary(), workEventStream(), worksRoutes(), ADR-0008 (+20 more)

### Community 38 - "WorkspaceScope"
Cohesion: 0.05
Nodes (27): connections, Доверенный scope и права, Проектирование адресов, HTTP, SSE и настройки, currentConnection(), DocumentsCommands, DocumentsQueries, FactsCommands (+19 more)

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

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
Cohesion: 0.12
Nodes (16): @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, fflate (+8 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "call.ts"
Cohesion: 0.09
Nodes (32): useWorkEvents(), WorkLive, documentPackageKeys, workKeys, CreateWorkInput, FactsDraft, useDeleteWork(), workDeletionQueryOptions() (+24 more)

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
Cohesion: 0.07
Nodes (29): BackendDependencies, config, countingSeams(), logger, api, clock, current, db (+21 more)

### Community 52 - "ids.ts"
Cohesion: 0.19
Nodes (18): Область и права, issueScope(), scopeWith(), assertUuid(), Brand, brandDocumentId(), brandFileId(), brandGenerationId() (+10 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "job-host.test.ts"
Cohesion: 0.10
Nodes (25): IdempotencyMaintenanceStore, ProcessingClaim, ProcessingStore, stepOutputSchema, activeAttempt(), claimRun(), documentPolicy, NotifyDocumentRun (+17 more)

### Community 55 - "ref_bun_test"
Cohesion: 0.17
Nodes (10): configured, json(), renderSettings(), serveSaveAnswer(), serveSettings(), sessionWith(), Settings, expectFocused() (+2 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.17
Nodes (10): HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости, Вывод, Два разных контракта, Практический вариант для Anyko, Что проверено, Контракт процессора, Локальный stateless MinerU (+2 more)

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

### Community 64 - "portable_shutdown.py"
Cohesion: 0.15
Nodes (6): model_path(), valid_model(), install(), main(), port(), ready()

### Community 65 - "ref_zod"
Cohesion: 0.13
Nodes (15): reconciliationSchema, descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), legacyFieldKeys (+7 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "ref_react"
Cohesion: 0.09
Nodes (39): RecognitionPage(), RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument() (+31 more)

### Community 73 - "unit-of-work.ts"
Cohesion: 0.19
Nodes (17): record(), createDocumentCommands(), createDocumentReadModel(), legacyPdf(), view(), nextRunRevision(), Connection, createProcessingCommands() (+9 more)

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
Cohesion: 0.15
Nodes (16): confirmValues(), editValues(), readFacts(), confirmFacts(), editFacts(), emptyFacts(), FactsPorts, FactsQueries (+8 more)

### Community 78 - "WorksModule"
Cohesion: 0.17
Nodes (28): Контекст, works, DocumentsModule, availablePackages(), requirePackage(), WorkError, WorksModule, WorksPorts (+20 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.24
Nodes (12): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+4 more)

### Community 80 - "client.ts"
Cohesion: 0.06
Nodes (34): This is NOT the Next.js you know, Архитектура, Интерфейс, dynamic, relay(), register(), HttpFetch, request() (+26 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.11
Nodes (15): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, cases, check(), checkedWebRules (+7 more)

### Community 82 - "ProcessingIo"
Cohesion: 0.25
Nodes (5): Единый механизм запусков, Выкат #22 в окно обслуживания, Выкат заданий и очередей, IoSubject, ProcessingIo

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.10
Nodes (29): createApp(), WorkHttpOptions, Analyze, appWith(), access, member, logger, contractModules (+21 more)

### Community 88 - "api/errors.ts"
Cohesion: 0.11
Nodes (19): revokeConnection(), uploadFailureMessage(), uploadTexts, connectionRevokedText, describeWorkCommandError(), workCommandTexts, ApiError, ApiErrorField (+11 more)

### Community 89 - "architecture.md"
Cohesion: 0.21
Nodes (5): Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "transactionHandle"
Cohesion: 0.10
Nodes (28): Ошибки, Как добавлять, Модуль, Ошибки, Повтор команд и журнал действий, Серверная часть, Структура, Тесты (+20 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.12
Nodes (9): descendant_handles(), initdb_diagnostic(), ModelHandler, request(), start(), child(), dead(), main() (+1 more)

### Community 95 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.10
Nodes (31): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+23 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "mutations.test.tsx"
Cohesion: 0.19
Nodes (18): renderWork(), source, result, Status, serveWork(), wrapperFor(), serveWork(), installEventSource() (+10 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.13
Nodes (17): combineCandidates(), Reconciliation, selectSessionCandidates(), AgentDocument, AgentUsage, DocumentAgents, AgentSession, AgentSessionContext (+9 more)

### Community 99 - "prepare.ts"
Cohesion: 0.18
Nodes (9): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, config, db, pool, redis (+1 more)

### Community 100 - "runtime/jobs.ts"
Cohesion: 0.27
Nodes (10): idempotencyCleanupJob(), defineJob(), RunPolicy, createJobRegistry(), documentMaintenanceJob(), documentOcrJob(), workAnalysisJob(), workGenerationJob() (+2 more)

### Community 101 - "http/route.ts"
Cohesion: 0.08
Nodes (33): ApiInput, AppOptions, BodyOf, checkedJson(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult() (+25 more)

### Community 102 - "documents/application/ports.ts"
Cohesion: 0.11
Nodes (18): DocumentResult, box, coordinate, documentResultSchema, pdfOcrSchema, formats, imageContainerFormat(), isDocx() (+10 more)

### Community 103 - "edit-values.test.ts"
Cohesion: 0.31
Nodes (8): failureOf(), ports(), scenario(), unused(), unusedFactsInternal, unusedWorkInternal, work, WORK_ID

### Community 104 - "start-api.ts"
Cohesion: 0.33
Nodes (5): parseBackendEnv(), schema, parseApiConfig(), schema, startApi()

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "routes/works/index.ts"
Cohesion: 0.06
Nodes (45): Sent, session, fieldKeySchema, documentSchema, AgentSession, AgentSessionContext, agentSessionContextSchema, agentSessionSchema (+37 more)

### Community 107 - "facts-form.test.tsx"
Cohesion: 0.11
Nodes (16): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+8 more)

### Community 108 - "start.ts"
Cohesion: 0.13
Nodes (14): agents, api, config, env, files, fixtureDb, fixturePool, logger (+6 more)

### Community 109 - "app.ts"
Cohesion: 0.12
Nodes (30): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+22 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "bfl/fields.ts"
Cohesion: 0.13
Nodes (15): factsSchema, StepOutput, workRunSchema, workStepSchema, collectionLabels, fieldKeySchema, FieldRow, fieldRowSchema (+7 more)

### Community 113 - "Решение"
Cohesion: 0.11
Nodes (18): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Последствия, Решение (+10 more)

### Community 114 - "catalog/schemas.ts"
Cohesion: 0.12
Nodes (16): NamedEndpoint, listDocumentPackages, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema (+8 more)

### Community 116 - "openapi.ts"
Cohesion: 0.22
Nodes (12): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), IdempotencyErrors (+4 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "processing/index.ts"
Cohesion: 0.07
Nodes (43): Как проверяются правила, AgentSessionStore, AgentsModule, AgentsPorts, AgentsDeps, AuditContext, AuditEvent, AuditRecord (+35 more)

### Community 119 - "Примеры v2"
Cohesion: 0.15
Nodes (12): C1, C2, C3, C4, C5, C6, C7, C8 (+4 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 122 - "session-gate.ts"
Cohesion: 0.13
Nodes (14): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+6 more)

### Community 124 - "create-backend.ts"
Cohesion: 0.06
Nodes (43): createDocumentAgents(), agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), DocumentParser, createArtifactRegistry(), createDeletionStore() (+35 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 127 - "endpoint.ts"
Cohesion: 0.11
Nodes (19): HTTP, EndpointSpec, endpointTag, EventsResponse, eventStream(), fileDownload(), FileResponse, Idempotency (+11 more)

### Community 128 - "templates/index.ts"
Cohesion: 0.11
Nodes (23): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), templateData(), block, cell (+15 more)

### Community 129 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 130 - "connection-settings.tsx"
Cohesion: 0.07
Nodes (38): clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), ApiErrorTexts, applyServerErrors() (+30 more)

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.18
Nodes (14): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+6 more)

### Community 132 - "works.test.ts"
Cohesion: 0.05
Nodes (39): workspaceWithWork(), memberScope(), startDocumentWorker(), api, contentTypes, db, files, logger (+31 more)

### Community 133 - ""WorkGeneration""
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "document-viewer.tsx"
Cohesion: 0.12
Nodes (26): documentKeys, DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer() (+18 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "Данные, доступ и фоновые задания"
Cohesion: 0.20
Nodes (10): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Единые таблицы запусков, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание (+2 more)

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 144 - "connections/endpoints.ts"
Cohesion: 0.13
Nodes (12): ConnectionHttpOptions, ConnectionSettingsApi, revokeLlmSettings, saveLlmSettings, ADR-0009, llmSettingsInputSchema, llmSettingsResponseSchema, savedStatusSchema (+4 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.20
Nodes (8): apiCatalogIsCurrent(), catalogFile, renderApiCatalog(), documents, errors, manifests, markdownFiles(), root

### Community 146 - "modules/documents/index.ts"
Cohesion: 0.08
Nodes (42): failed, queued, store(), unused(), listDocuments(), readPosition(), listPendingDeletions(), Artifact (+34 more)

### Community 147 - "[file]/route.ts"
Cohesion: 0.33
Nodes (4): assetTypes, GET(), LlmSettings, Подключение модели

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "work-analysis/index.ts"
Cohesion: 0.18
Nodes (20): DocumentAnalysis, generateDocument(), WorkRunRecord, failureOf(), WorkSummary, isAppError(), ContinuationSource, createWorkContinuation() (+12 more)

### Community 150 - ""DocumentIo""
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

### Community 151 - "modules/connections/index.ts"
Cohesion: 0.13
Nodes (16): createAuditModule(), input, LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection(), saveConnection() (+8 more)

### Community 152 - "createQueryClient"
Cohesion: 0.16
Nodes (19): WorkspaceLayout(), AppShell(), renderShell(), user, session, createdWorkView, existingWork, json() (+11 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.05
Nodes (35): SourceStorage, createS3Storage(), BackendConfig, BackendConfigError, BackendConfigErrorCode, backendConfigSchema, encryptionKey, httpUrl (+27 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.23
Nodes (15): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), automaticValue(), Candidate, checksum(), date() (+7 more)

### Community 158 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "createQueryClient"
Cohesion: 0.21
Nodes (9): manrope, metadata, onest, RootLayout(), Providers(), renderWorkspace(), renderWorkList(), ToastProvider() (+1 more)

### Community 161 - "RunDefinition"
Cohesion: 0.40
Nodes (3): CommonDefinition, RunDefinition, ScheduledDefinition

### Community 162 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 164 - "src/session/index.ts"
Cohesion: 0.18
Nodes (7): Call, session, rights, rightSchema, ADR-0009, Membership, membershipSchema

### Community 167 - "startBlackHole"
Cohesion: 0.14
Nodes (13): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+5 more)

### Community 168 - "ref_node_path"
Cohesion: 0.09
Nodes (12): output, env, lock, root, hook, root, links, marker (+4 more)

### Community 169 - ".dependency-cruiser.cjs"
Cohesion: 0.40
Nodes (4): { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations

### Community 170 - "src/works/index.ts"
Cohesion: 0.08
Nodes (34): analysisRuns(), groupSteps(), Run, runProgress(), Step, Run, Step, visionVisuals() (+26 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "scroll-sync.ts"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 173 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 177 - "start-worker.ts"
Cohesion: 0.15
Nodes (13): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime(), envelope (+5 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 184 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 185 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Каталог HTTP API"
Cohesion: 0.40
Nodes (5): catalog, connections, documents, session, Каталог HTTP API

### Community 193 - "work-pipeline.tsx"
Cohesion: 0.13
Nodes (24): SessionContext(), Files(), Generation, generationTones, WorkResults(), Document, ImageUrl, Run (+16 more)

### Community 195 - "ExecutionScope"
Cohesion: 0.15
Nodes (8): RenderBoundary, Фоновые задания, SavedJobRun, run, JobEnvelope, JobRegistry, ExecutionScope, issueExecutionScope()

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 200 - "startJobWorker"
Cohesion: 0.13
Nodes (19): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Задания, currentEnvelope, identity, JobDelivery (+11 more)

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1547 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `idempotency/index.ts`, `ids.ts`, `LogReaderTests`, `transactionHandle`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `session-gate.ts` to `package.json`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._