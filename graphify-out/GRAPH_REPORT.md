# Graph Report - anyko  (2026-11-18)

## Corpus Check
- 637 files · ~260,108 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 3522 nodes · 9060 edges · 188 communities (162 shown, 26 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `31acc8eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- Anyko — брендбук
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- facts-form.ts
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- launcher.py
- read-logs.py
- Logger
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- database/src/index.ts
- support/scope.ts
- exports
- web/tsconfig.json
- portable_shutdown.py
- Проверка качества
- engineering/README.md
- idempotency/index.ts
- logger/package.json
- app-shell.tsx
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- fields.tsx
- Runtime и диагностика
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- modules/connections/index.ts
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- runtime/index.ts
- work-list.tsx
- llm/package.json
- work-screen.tsx
- startJobWorker
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- smoke.py
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- generation/index.ts
- ref_zod
- dependencies
- database/README.md
- Processor
- devDependencies
- WorkDeletionStore
- works.test.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- callApi
- ids.ts
- agent-github.mjs
- ProcessorReview
- boundaries.test.ts
- work-pipeline.tsx
- stage-windows-migrator.mjs
- check-project.mjs
- dev.mjs
- devDependencies
- database/src/index.ts
- facts/index.ts
- journeys.spec.ts
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- document-deletion.test.ts
- transactions/index.ts
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- facts-form.test.tsx
- agents/index.ts
- modules/documents/index.ts
- facts-form.test.tsx
- http/route.ts
- .require
- runtime/jobs.ts
- routes/documents/index.ts
- exports
- catalog/schemas.ts
- WorkProcessingStore
- ProcessingIo
- app.ts
- llm/tsconfig.json
- integration/idempotency.test.ts
- dependencies.md
- Решение
- Button
- DocumentStore
- upload.ts
- workspace-states.tsx
- bfl/fields.ts
- Примеры v1
- Agent skills
- 202611170017_unified_processing/migration.sql
- session-gate.ts
- build-windows-web.mjs
- create-backend.ts
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- endpoint.ts
- templates/index.ts
- job-host.test.ts
- call.ts
- "AnykoWorkspace"
- worker.ts
- "WorkGeneration"
- ui/package.json
- Язык Anyko
- @tanstack/react-query
- result-preview.tsx
- Работа агентов и независимая проверка
- routes/works/index.ts
- 202611060012_work_agent_sessions/migration.sql
- connections/endpoints.ts
- api/errors.ts
- ExecutionScope
- generation/index.ts
- frontend.js
- work-analysis/index.ts
- "DocumentIo"
- stage-windows-web.mjs
- app/layout.tsx
- documents.test.ts
- setup.ts
- Данные, доступ и фоновые задания
- .render
- server/config.ts
- prepare-storage.ts
- build-windows-portable.mjs
- jobs/index.ts
- architecture.md
- unit-of-work.ts
- FakeEventSource
- startBlackHole
- ref_node_path
- documents/application/ports.ts
- access.test.ts
- document-recognition/api/queries.ts
- logger/src/index.ts
- smoke-windows-mineru.mjs
- e2e/tsconfig.json
- Решение
- bootstrap.mjs
- start-api.ts
- ui/tsconfig.json
- Направления развития Anyko
- transactions/index.ts
- session/schemas.ts
- sha256Hex
- edit-values.test.ts
- routes/documents/index.ts
- documents/application/commands.test.ts
- server/session.test.ts
- .dependency-cruiser.cjs

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 101 edges
2. `createBackend()` - 85 edges
3. `Button()` - 64 edges
4. `scripts` - 63 edges
5. `WorkId` - 52 edges
6. `Tx` - 42 edges
7. `callApi()` - 38 edges
8. `createLogger()` - 36 edges
9. `@tanstack/react-query` - 35 edges
10. `WorksModule` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `Правила зависимостей` --references--> `Tx`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/platform/transactions/index.ts
- `Композиция процесса` --references--> `createBackend()`  [INFERRED]
  docs/adr/0009-backend-architecture.md → packages/backend/src/runtime/create-backend.ts
- `Тесты` --references--> `createBackend()`  [INFERRED]
  docs/engineering/backend.md → packages/backend/src/runtime/create-backend.ts
- `Структура запуска приложений` --references--> `createBackend()`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/runtime/create-backend.ts

## Import Cycles
- None detected.

## Communities (188 total, 26 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.14
Nodes (14): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+6 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (18): This is NOT the Next.js you know, Архитектура, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот (+10 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "facts-form.ts"
Cohesion: 0.09
Nodes (46): allKeys(), FactValues, sameFieldValue(), sameFieldValues(), sameRow(), mentions(), previewEntries(), FactConflict (+38 more)

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
Cohesion: 0.24
Nodes (7): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query()

### Community 11 - "Logger"
Cohesion: 0.18
Nodes (13): ApiInput, AppOptions, ConnectionHttpOptions, DocumentHttpOptions, WorkHttpOptions, LlmSettingsInput, ConnectionSettingsApi, ApiBackend (+5 more)

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
Nodes (63): scripts, access:provision-local, agent:github, artifacts:migrate, boundaries, build, build:windows, build:windows:components (+55 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "database/src/index.ts"
Cohesion: 0.10
Nodes (21): BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool(), DatabasePool (+13 more)

### Community 21 - "support/scope.ts"
Cohesion: 0.21
Nodes (12): ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor(), scopeWith(), parseUserId(), parseWorkspaceId() (+4 more)

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
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "engineering/README.md"
Cohesion: 0.21
Nodes (7): graphify, Один модульный монолит с отдельными процессами, API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 27 - "idempotency/index.ts"
Cohesion: 0.13
Nodes (22): memoryIdempotency(), Row, AcquireInput, AcquireOutcome, IdempotencyKeyRef, IdempotencyStore, StoredResponse, IdempotencyDeps (+14 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "app-shell.tsx"
Cohesion: 0.12
Nodes (24): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), ShellFrame() (+16 more)

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

### Community 37 - "fields.tsx"
Cohesion: 0.06
Nodes (48): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), useRevokeLlmSettings() (+40 more)

### Community 38 - "Runtime и диагностика"
Cohesion: 0.29
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

### Community 41 - "processor.py"
Cohesion: 0.10
Nodes (4): erase(), health(), parse(), VisualExportReview

### Community 42 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @anyko/contracts, @anyko/logger, @anyko/ui, @base-ui/react, katex, lucide-react, next (+13 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "backend/package.json"
Cohesion: 0.08
Nodes (25): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, @anyko/database, @anyko/llm, @anyko/logger (+17 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "modules/connections/index.ts"
Cohesion: 0.09
Nodes (29): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditModule, AuditConnection (+21 more)

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "stage-windows-release.mjs"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.08
Nodes (24): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+16 more)

### Community 51 - "runtime/index.ts"
Cohesion: 0.06
Nodes (32): BackendConfig, BackendConfigError, BackendConfigErrorCode, backendConfigSchema, encryptionKey, httpUrl, postgresUrl, redisUrl (+24 more)

### Community 52 - "work-list.tsx"
Cohesion: 0.10
Nodes (31): WorkNotFound(), WorkListPage(), useWorkEvents(), WorkLive, documentPackageKeys, workKeys, CreateWorkInput, FactsDraft (+23 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "work-screen.tsx"
Cohesion: 0.10
Nodes (33): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), fail() (+25 more)

### Community 55 - "startJobWorker"
Cohesion: 0.25
Nodes (8): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), runDiagnostic(), createWorkerRuntime(), backendEnv, worker

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.11
Nodes (17): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "smoke.py"
Cohesion: 0.24
Nodes (3): visual_inputs(), main(), request()

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

### Community 64 - "generation/index.ts"
Cohesion: 0.11
Nodes (13): Доверенный scope и права, DocumentsCommands, DocumentsQueries, FactsCommands, GenerationQueries, GenerationView, WorksCommands, WorksQueries (+5 more)

### Community 65 - "ref_zod"
Cohesion: 0.12
Nodes (15): reconciliationSchema, descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), legacyFieldKeys (+7 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 73 - "works.test.ts"
Cohesion: 0.07
Nodes (27): createDocumentAgents(), workspaceWithWork(), memberScope(), upload(), waitFor(), actualPool, agents, apiBackend (+19 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "callApi"
Cohesion: 0.10
Nodes (33): RecognitionPage(), RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument() (+25 more)

### Community 78 - "ids.ts"
Cohesion: 0.08
Nodes (31): Область и права, attachDocument(), bumpRevision(), createWork(), failureOf(), findWork(), listEvents(), listWorks() (+23 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "ProcessorReview"
Cohesion: 0.19
Nodes (4): ProcessorReview, fake_parse(), sync_parse(), Result

### Community 81 - "boundaries.test.ts"
Cohesion: 0.11
Nodes (15): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, cases, check(), checkedWebRules (+7 more)

### Community 82 - "work-pipeline.tsx"
Cohesion: 0.12
Nodes (24): analysisRuns(), groupSteps(), Run, runProgress(), Step, Run, Step, visionVisuals() (+16 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "database/src/index.ts"
Cohesion: 0.08
Nodes (27): Повтор команд и журнал действий, AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), E2E_QUEUE_PREFIX, parseE2eConfig(), schema (+19 more)

### Community 88 - "facts/index.ts"
Cohesion: 0.17
Nodes (16): confirmValues(), editValues(), readFacts(), confirmFacts(), editFacts(), emptyFacts(), FactsPorts, FactsQueries (+8 more)

### Community 89 - "journeys.spec.ts"
Cohesion: 0.33
Nodes (4): @playwright/test, ObservedEventSource, required(), signIn()

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 92 - "document-deletion.test.ts"
Cohesion: 0.08
Nodes (31): agentSessionStoreFor(), createAgentSessionStore(), createAgentsModule(), ArtifactRegistry, DocumentParser, createArtifactRegistry(), createDeletionStore(), createMineruParser() (+23 more)

### Community 93 - "transactions/index.ts"
Cohesion: 0.12
Nodes (40): ConnectionsModule, ResourceLocks, DocumentsModule, FactsModule, GenerationModule, ProcessingModule, availablePackages(), WorkError (+32 more)

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.11
Nodes (8): descendant_handles(), initdb_diagnostic(), ModelHandler, start(), child(), dead(), main(), supervisor()

### Community 95 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.10
Nodes (31): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+23 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "facts-form.test.tsx"
Cohesion: 0.18
Nodes (19): renderWork(), source, result, Status, serveWork(), renderCommands(), wrapperFor(), serveWork() (+11 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.14
Nodes (12): combineCandidates(), Reconciliation, selectSessionCandidates(), DocumentAgents, AgentSession, AgentSessionContext, agentSessionContextSchema, agentSessionSchema (+4 more)

### Community 99 - "modules/documents/index.ts"
Cohesion: 0.11
Nodes (13): DocumentResult, DocumentView, DocumentErrors, DocumentDeletionStatus, DocumentImage, DocumentResultView, DocumentsInternal, DocumentSourceFile (+5 more)

### Community 100 - "facts-form.test.tsx"
Cohesion: 0.11
Nodes (16): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+8 more)

### Community 101 - "http/route.ts"
Cohesion: 0.10
Nodes (25): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+17 more)

### Community 102 - ".require"
Cohesion: 0.31
Nodes (12): listDocuments(), listPendingDeletions(), readDeletion(), readDocument(), readImage(), readResult(), readSource(), removeDocument() (+4 more)

### Community 103 - "runtime/jobs.ts"
Cohesion: 0.27
Nodes (10): idempotencyCleanupJob(), defineJob(), RunPolicy, createJobRegistry(), documentMaintenanceJob(), documentOcrJob(), workAnalysisJob(), workGenerationJob() (+2 more)

### Community 104 - "routes/documents/index.ts"
Cohesion: 0.15
Nodes (13): documentParams, getDocument, getDocumentImage, getDocumentResult, getDocumentSource, listDocuments, deletingStatusSchema, documentDeletionSchema (+5 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "catalog/schemas.ts"
Cohesion: 0.12
Nodes (15): fieldKeySchema, documentPackageSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, PreviewBlock, previewBlockSchema, previewCellSchema (+7 more)

### Community 107 - "WorkProcessingStore"
Cohesion: 0.07
Nodes (17): isActive(), listRuns(), startRun(), StepOutput, stepOutputSchema, WorkProcessingStore, WorkRuns, workRunSchema (+9 more)

### Community 108 - "ProcessingIo"
Cohesion: 0.13
Nodes (12): Единый механизм запусков, Единые таблицы запусков, Восстановление и данные, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Начальная топология, Порядок выпуска, Процесс и наблюдаемость (+4 more)

### Community 109 - "app.ts"
Cohesion: 0.09
Nodes (34): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+26 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "integration/idempotency.test.ts"
Cohesion: 0.13
Nodes (11): createIdempotencyMaintenanceStore(), createIdempotencyMaintenance(), IdempotencyMaintenanceStore, api, clock, current, db, logger (+3 more)

### Community 113 - "Решение"
Cohesion: 0.10
Nodes (21): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Последствия (+13 more)

### Community 114 - "Button"
Cohesion: 0.08
Nodes (53): documentResultQueryOptions(), recognitionRetryCode, recognitionRetryText, DocumentRow(), labels, SelectionCheckbox(), tones, documentKind() (+45 more)

### Community 116 - "upload.ts"
Cohesion: 0.18
Nodes (11): formats, isDocx(), matchesSourceFormat(), sourceContentTypes, SourceFormat, sourceFormatFromKey(), startsWith(), contentTypes (+3 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "bfl/fields.ts"
Cohesion: 0.16
Nodes (17): factsSchema, templateData(), candidateSchema, collectionLabels, emptyFieldValues(), fieldIdentity(), fieldKeySchema, FieldRow (+9 more)

### Community 119 - "Примеры v1"
Cohesion: 0.14
Nodes (11): C1, C2, C3, C4, C5, C6, C7, Примеры v1 (+3 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 122 - "session-gate.ts"
Cohesion: 0.21
Nodes (10): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+2 more)

### Community 124 - "create-backend.ts"
Cohesion: 0.10
Nodes (26): ProcessingClaim, ProcessingStore, start(), activeAttempt(), claimRun(), documentPolicy, NotifyDocumentRun, recoverRuns() (+18 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 127 - "endpoint.ts"
Cohesion: 0.07
Nodes (33): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+25 more)

### Community 128 - "templates/index.ts"
Cohesion: 0.13
Nodes (18): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), block, cell, document (+10 more)

### Community 129 - "job-host.test.ts"
Cohesion: 0.17
Nodes (6): resultSchema, envelope, State, logger, createQueueProbe(), bullmq

### Community 130 - "call.ts"
Cohesion: 0.10
Nodes (26): BodyField, CallArgs, CallOptions, encodeBody(), endpointUrl(), fillPath(), idempotencyHeaders(), isRecord() (+18 more)

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.18
Nodes (14): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+6 more)

### Community 132 - "worker.ts"
Cohesion: 0.17
Nodes (12): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Задания, JobRuntime, parseJobEnvelope(), parseWorkerQueues() (+4 more)

### Community 133 - ""WorkGeneration""
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "@tanstack/react-query"
Cohesion: 0.11
Nodes (31): WorkspaceLayout(), AppShell(), renderShell(), user, session, configured, json(), renderSettings() (+23 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.20
Nodes (9): cyrillicMathMacros, ResultPreview(), schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "routes/works/index.ts"
Cohesion: 0.07
Nodes (41): Sent, session, fieldValueSchema, fieldValuesSchema, analyzeWork, confirmWork, createWork, deleteWork (+33 more)

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 144 - "connections/endpoints.ts"
Cohesion: 0.15
Nodes (13): connectionKeys, LlmSettingsInput, ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, getLlmSettings, revokeLlmSettings (+5 more)

### Community 145 - "api/errors.ts"
Cohesion: 0.11
Nodes (22): documentTexts, conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), uploadFailureMessage(), uploadTexts, connectionRevokedText (+14 more)

### Community 146 - "ExecutionScope"
Cohesion: 0.21
Nodes (8): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, JobRegistry, ExecutionScope, issueExecutionScope()

### Community 147 - "generation/index.ts"
Cohesion: 0.13
Nodes (12): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationRecord, GenerationStore (+4 more)

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "work-analysis/index.ts"
Cohesion: 0.12
Nodes (29): AgentDocument, AgentsModule, AgentsPorts, AgentUsage, generateDocument(), WorkRunRecord, requirePackage(), WorkSummary (+21 more)

### Community 150 - ""DocumentIo""
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

### Community 151 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 152 - "app/layout.tsx"
Cohesion: 0.28
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 153 - "documents.test.ts"
Cohesion: 0.10
Nodes (16): SourceStorage, createSourceCleanup(), startDocumentWorker(), api, contentTypes, db, files, logger (+8 more)

### Community 155 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 158 - "server/config.ts"
Cohesion: 0.13
Nodes (13): dynamic, relay(), register(), HttpFetch, requestApi(), failWith(), proxyApiRequest(), requestHeaders (+5 more)

### Community 160 - "build-windows-portable.mjs"
Cohesion: 0.33
Nodes (3): env, lock, root

### Community 161 - "jobs/index.ts"
Cohesion: 0.12
Nodes (10): CommonDefinition, currentEnvelope, DeliveryPort, identity, JobDelivery, RetryPolicy, RunDefinition, ScheduledDefinition (+2 more)

### Community 162 - "architecture.md"
Cohesion: 0.11
Nodes (14): Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере (+6 more)

### Community 164 - "unit-of-work.ts"
Cohesion: 0.21
Nodes (12): createDocumentCommands(), createDocumentReadModel(), statusSchema, nextRunRevision(), Connection, createProcessingCommands(), Start, createDocumentUnitOfWork() (+4 more)

### Community 167 - "startBlackHole"
Cohesion: 0.13
Nodes (14): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+6 more)

### Community 168 - "ref_node_path"
Cohesion: 0.13
Nodes (8): config, output, links, marker, components, env, root, [target, link]

### Community 169 - "documents/application/ports.ts"
Cohesion: 0.26
Nodes (7): Artifact, DocumentDeps, DocumentStatus, readAnalysis(), readArtifact(), documentResultSchema, DocumentAnalysis

### Community 170 - "access.test.ts"
Cohesion: 0.29
Nodes (3): delete(), get(), ADR-0009

### Community 171 - "document-recognition/api/queries.ts"
Cohesion: 0.24
Nodes (6): documentKeys, DocumentOwner, recognitionPollInterval(), recognitionPollMs, RecognitionSnapshot, getWorkDocumentResult

### Community 172 - "logger/src/index.ts"
Cohesion: 0.11
Nodes (21): createApp(), authRoutes(), Analyze, appWith(), access, member, logger, contractModules (+13 more)

### Community 173 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 175 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 176 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 177 - "start-api.ts"
Cohesion: 0.33
Nodes (5): parseBackendEnv(), schema, parseApiConfig(), schema, startApi()

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 180 - "transactions/index.ts"
Cohesion: 0.08
Nodes (38): LlmSettings, formData(), Ошибки, Как добавлять, Как проверяются правила, Модуль, Ошибки, Подключение модели (+30 more)

### Community 181 - "session/schemas.ts"
Cohesion: 0.24
Nodes (7): getSession, rights, rightSchema, ADR-0009, Membership, membershipSchema, sessionResponseSchema

### Community 182 - "sha256Hex"
Cohesion: 0.39
Nodes (5): canonicalize(), fingerprintInput(), ADR-0009, sha256Hex(), ADR-0009

### Community 183 - "edit-values.test.ts"
Cohesion: 0.31
Nodes (8): failureOf(), ports(), scenario(), unused(), unusedFactsInternal, unusedWorkInternal, work, WORK_ID

### Community 184 - "routes/documents/index.ts"
Cohesion: 0.61
Nodes (6): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), worksRoutes(), brandDocumentId()

### Community 185 - "documents/application/commands.test.ts"
Cohesion: 0.40
Nodes (4): failed, queued, store(), unused()

### Community 187 - ".dependency-cruiser.cjs"
Cohesion: 0.40
Nodes (4): { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations

## Knowledge Gaps
- **150 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+145 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1478 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `ids.ts`, `transactions/index.ts`, `Первая вертикаль обработки документов`, `LogReaderTests`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _150 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `journeys.spec.ts` to `package.json`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._