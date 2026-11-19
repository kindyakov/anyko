# Graph Report - anyko  (2026-11-19)

## Corpus Check
- 789 files · ~355,296 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 4529 nodes · 11701 edges · 224 communities (183 shown, 41 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 269 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f69226f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- documents/module.ts
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- add-recognitions-to-work.tsx
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
- processing/index.ts
- exports
- web/tsconfig.json
- jobs/index.ts
- Проверка качества
- Issue tracker: GitHub
- idempotency/index.ts
- logger/package.json
- routes.ts
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- routes/documents/index.ts
- modules/works/index.ts
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- api/errors.ts
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- catalog-deletion.ts
- ids.ts
- llm/package.json
- @tanstack/react-query
- api/errors.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- WorkspaceScope
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- test_processor.py
- ref_zod
- dependencies
- database/README.md
- Processor
- devDependencies
- @tanstack/react-query
- facts-form.ts
- scripts
- endpoint.ts
- Устройство репозитория
- README.md
- work-screen.tsx
- agent-github.mjs
- api/errors.ts
- boundaries.test.ts
- works/schemas.ts
- stage-windows-migrator.mjs
- transactions/index.ts
- dev.mjs
- devDependencies
- logger/src/index.ts
- audit/index.ts
- integration/idempotency.test.ts
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- journeys.spec.ts
- Runtime и диагностика
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- ref_bun_test
- http/route.ts
- workspace-states.tsx
- RunDefinition
- Button
- ref_node_fs
- create-backend.ts
- bfl/fields.ts
- exports
- generation/index.ts
- work-ports.ts
- start.ts
- app.ts
- llm/tsconfig.json
- modules/documents/index.ts
- unit-of-work.test.ts
- Решение
- session-store.ts
- DocumentStore
- works/api/queries.ts
- ref_react
- modules/documents/index.ts
- Примеры v2
- documents/endpoints.ts
- 202611170017_unified_processing/migration.sql
- document-values/package.json
- build-windows-web.mjs
- update-recognition.ts
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- ProcessingIo
- agents/index.ts
- engineering/README.md
- connection-settings.tsx
- "AnykoWorkspace"
- works.test.ts
- connections/api/mutations.ts
- 202611050006_uncertain_writes/migration.sql
- documents.test.ts
- 202611050011_bankruptcy_package_v3/migration.sql
- ui/package.json
- Язык Anyko
- facts/index.ts
- call.ts
- routes/works/index.ts
- fingerprintInput
- 202611060012_work_agent_sessions/migration.sql
- access.test.ts
- support/endpoints.ts
- build-windows-portable.mjs
- openapi.ts
- frontend.js
- continue-session.ts
- HTML Report Format
- Размещение основы в Dokploy
- diagnostic-worker.test.ts
- start-api.ts
- setup.ts
- Решение
- automatic-value.ts
- idempotency/jobs.ts
- pdf_ocr.py
- Anyko — брендбук
- runtime/jobs.ts
- smoke-windows-mineru.mjs
- ui/src/index.ts
- DeliveryPort
- FakeEventSource
- 202611170016_generation_connection_revision/migration.sql
- black-hole-renderer.ts
- Anyko
- Triage
- server/session.test.ts
- Направления развития Anyko
- Размещение и эксплуатация
- e2e/tsconfig.json
- templates/index.ts
- audit/index.ts
- ui/tsconfig.json
- document-values/tsconfig.json
- .test_two_matching_readings_preserve_number_and_a_conflict_is_excluded
- writing-for-agents/SKILL.md
- wayfinder/SKILL.md
- @tanstack/react-query
- server/session.test.ts
- Triage
- stage-windows-web.mjs
- ProcessingIo
- bootstrap.mjs
- WorksModule
- job-scope.ts
- "WorkDocument"
- ProcessorReview
- VisualExportReview
- DocumentId
- hitl-loop.template.sh
- work-view/index.ts
- Sections
- Process
- grilling/SKILL.md
- Agent skills
- implement/SKILL.md
- smoke-windows-mineru.mjs
- wait-what/SKILL.md
- Проверка тестов, написанных агентом
- Каталог HTTP API
- ExecutionScope
- result-preview.tsx
- WorkDeletionStore
- devDependencies
- scripts

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 105 edges
2. `Button()` - 96 edges
3. `createBackend()` - 88 edges
4. `scripts` - 64 edges
5. `WorkId` - 56 edges
6. `Tx` - 53 edges
7. `@tanstack/react-query` - 51 edges
8. `callApi()` - 51 edges
9. `Notice()` - 47 edges
10. `WorkStore` - 40 edges

## Surprising Connections (you probably didn't know these)
- `Повтор команд и журнал действий` --references--> `provisionLocalAccess()`  [INFERRED]
  docs/engineering/backend.md → packages/backend/src/modules/access/infrastructure/auth.ts
- `Контракт процессора` --references--> `createMineruParser()`  [INFERRED]
  docs/engineering/mineru.md → packages/backend/src/modules/documents/infrastructure/mineru.ts
- `Правила зависимостей` --references--> `Tx`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/platform/transactions/index.ts
- `Композиция процесса` --references--> `createBackend()`  [INFERRED]
  docs/adr/0009-backend-architecture.md → packages/backend/src/runtime/create-backend.ts
- `Тесты` --references--> `createBackend()`  [INFERRED]
  docs/engineering/backend.md → packages/backend/src/runtime/create-backend.ts

## Import Cycles
- None detected.

## Communities (224 total, 41 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (24): @anyko/contracts, @anyko/document-values, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form (+16 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (33): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+25 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.13
Nodes (15): hook, root, createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root (+7 more)

### Community 3 - "documents/module.ts"
Cohesion: 0.27
Nodes (11): documentLockKey(), idempotencyCleanupJob(), DocumentArtifacts, defineJob(), RunPolicy, createJobRegistry(), documentMaintenanceJob(), documentOcrJob() (+3 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "add-recognitions-to-work.tsx"
Cohesion: 0.15
Nodes (27): RecognitionPage(), WorkNotFound(), WorkListPage(), DocumentWorkspace(), OcrRevisionAction(), documentPackagesQueryOptions(), invalidateWorkspaceWorks(), worksQueryOptions() (+19 more)

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
Cohesion: 0.25
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

### Community 20 - "modules/works/index.ts"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "processing/index.ts"
Cohesion: 0.09
Nodes (58): AgentsModule, ConnectionsModule, ResourceLocks, FactEvidence, FactsModule, FactsPorts, GenerationModule, ProcessingModule (+50 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "jobs/index.ts"
Cohesion: 0.13
Nodes (15): dispatchOutbox(), reconcileJobs(), CommonDefinition, currentEnvelope, identity, JobDelivery, JobRuntime, RetryPolicy (+7 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Issue tracker: GitHub"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.15
Nodes (19): Row, AcquireInput, AcquireOutcome, CommandResponse, IdempotencyKeyRef, IdempotencyStore, StoredOutcome, StoredResponse (+11 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "routes.ts"
Cohesion: 0.07
Nodes (41): config, dynamic, relay(), LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen() (+33 more)

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
Cohesion: 0.08
Nodes (35): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+27 more)

### Community 38 - "modules/works/index.ts"
Cohesion: 0.06
Nodes (28): connections, activeDocument(), attachDocuments(), createWork(), findWork(), listEvents(), listWorks(), notifyDocumentChanged() (+20 more)

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

### Community 41 - "processor.py"
Cohesion: 0.10
Nodes (15): image_png(), media_entries(), prepare_docx(), replace_missing_visuals(), erase(), health(), parse(), parse_source() (+7 more)

### Community 42 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @anyko/contracts, @anyko/document-values, @anyko/logger, @anyko/ui, @base-ui/react, docx-preview, katex (+15 more)

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "backend/package.json"
Cohesion: 0.11
Nodes (17): @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+9 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "api/errors.ts"
Cohesion: 0.13
Nodes (39): invalidateDocumentCatalog(), RecognitionAction, requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion() (+31 more)

### Community 48 - "database/package.json"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "stage-windows-release.mjs"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "contracts/package.json"
Cohesion: 0.08
Nodes (24): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+16 more)

### Community 51 - "catalog-deletion.ts"
Cohesion: 0.13
Nodes (27): Connection, createDocumentCommands(), lockLiveDocumentForResponse(), Registration, createDocumentReadModel(), legacyPdf(), view(), RunSummary (+19 more)

### Community 52 - "ids.ts"
Cohesion: 0.17
Nodes (18): access, member, memberSession, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor() (+10 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "@tanstack/react-query"
Cohesion: 0.07
Nodes (40): manrope, metadata, onest, RootLayout(), Providers(), renderShell(), user, session (+32 more)

### Community 55 - "api/errors.ts"
Cohesion: 0.13
Nodes (23): revokeConnection(), draftForSave(), conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), applyFormChange(), readRevision() (+15 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.11
Nodes (17): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "WorkspaceScope"
Cohesion: 0.10
Nodes (20): Доверенный scope и права, works, DocumentsCommands, DocumentsModule, DocumentsQueries, FactsCommands, WorkRuns, ProcessingCommands (+12 more)

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

### Community 64 - "test_processor.py"
Cohesion: 0.09
Nodes (4): model_path(), valid_model(), install(), RasterRecoveryReview

### Community 65 - "ref_zod"
Cohesion: 0.08
Nodes (31): createDocumentAgents(), descriptionSchema, extractionSchema, transcriptionSchema, createReconciliationAgent(), reconciliationResponseSchema, invalidResponse(), retryVisionResponse() (+23 more)

### Community 66 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+7 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "@tanstack/react-query"
Cohesion: 0.07
Nodes (57): documentKeys, DocumentFilters, DocumentOwner, documentsQueryOptions(), recognitionStatusQueryOptions(), fileChecksum(), findUploadMatches(), actionNotice() (+49 more)

### Community 73 - "facts-form.ts"
Cohesion: 0.06
Nodes (73): applyRevision(), FactsDraft, FactsDraftEvent, FactsDraftTransition, FactsFormChange, FactsRevision, hasFactsDraftEdits(), rebaseFacts() (+65 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "endpoint.ts"
Cohesion: 0.06
Nodes (38): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), NamedEndpoint (+30 more)

### Community 76 - "Устройство репозитория"
Cohesion: 0.15
Nodes (12): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия, Frontend, Как добавлять новое, Правила зависимостей (+4 more)

### Community 77 - "README.md"
Cohesion: 0.17
Nodes (6): Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Выводы агента, продолжение анализа и форматы подстановки

### Community 78 - "work-screen.tsx"
Cohesion: 0.07
Nodes (47): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), WorkScreen(), fields() (+39 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "api/errors.ts"
Cohesion: 0.20
Nodes (5): deleteCatalogDocument(), DeletionPorts, ImpactPorts, impactToken(), readDeletionImpact()

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "works/schemas.ts"
Cohesion: 0.04
Nodes (58): HTTP, fieldKeySchema, fieldValueSchema, fieldValuesSchema, eventStream(), fileDownload(), pageResponseSchema(), agentHistoryEvent (+50 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "transactions/index.ts"
Cohesion: 0.10
Nodes (32): claimDocumentAttempt(), documentOcrPolicy, start(), activeAttempt(), claimRun(), finishRun(), NotifyDocumentRun, recoverRuns() (+24 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.09
Nodes (23): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), createApp(), Analyze, appWith() (+15 more)

### Community 88 - "audit/index.ts"
Cohesion: 0.14
Nodes (19): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+11 more)

### Community 89 - "integration/idempotency.test.ts"
Cohesion: 0.09
Nodes (26): Connection, createIdempotencyStore(), idempotencyStoreFor(), redactResourceResponses(), workSummarySchema, createWorkDeletionStore(), lockLiveWorkForResponse(), lockLiveWorkUploadForResponse() (+18 more)

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "journeys.spec.ts"
Cohesion: 0.50
Nodes (3): ObservedEventSource, required(), signIn()

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.09
Nodes (12): descendant_handles(), initdb_diagnostic(), ModelHandler, request(), start(), main(), port(), ready() (+4 more)

### Community 95 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "ref_bun_test"
Cohesion: 0.09
Nodes (33): renderWork(), source, result, deletionImpactToken, Status, FactsEditor(), FactsScreen(), fieldNamed() (+25 more)

### Community 98 - "http/route.ts"
Cohesion: 0.10
Nodes (29): BodyOf, checkedJson(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), KeyedResponse, ParsedPart (+21 more)

### Community 99 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 100 - "RunDefinition"
Cohesion: 0.14
Nodes (25): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkEvent" (+17 more)

### Community 101 - "Button"
Cohesion: 0.14
Nodes (23): FactsForm, ConflictValue(), EditConflicts(), SessionContext(), UnsavedFactsBar(), Document, WorkReview(), agentHistoryQuery() (+15 more)

### Community 102 - "ref_node_fs"
Cohesion: 0.08
Nodes (13): assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, links, marker (+5 more)

### Community 103 - "create-backend.ts"
Cohesion: 0.05
Nodes (45): createAgentsModule(), ArtifactRegistry, DocumentParser, createArtifactRegistry(), createDeletionStore(), createMineruParser(), createReadyResults(), lockDocumentRevisions() (+37 more)

### Community 104 - "bfl/fields.ts"
Cohesion: 0.12
Nodes (18): agentSessionContextSchema, agentSessionSchema, factsSchema, candidateBaseSchema, extractedCandidateSchema, collectionLabels, dateFields, fieldKeySchema (+10 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "generation/index.ts"
Cohesion: 0.10
Nodes (16): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationQueries, GenerationRecord (+8 more)

### Community 107 - "work-ports.ts"
Cohesion: 0.07
Nodes (26): DocumentAttempt, isActive(), listRuns(), DocumentAttemptStore, DocumentRunOutcome, DocumentRunSnapshot, claimRunAttempt(), RunAttempt (+18 more)

### Community 108 - "start.ts"
Cohesion: 0.08
Nodes (23): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, config, db, pool, redis (+15 more)

### Community 109 - "app.ts"
Cohesion: 0.09
Nodes (34): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+26 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "modules/documents/index.ts"
Cohesion: 0.06
Nodes (66): deleteDocument(), documents, failed, queued, store(), unused(), listDocuments(), readPosition() (+58 more)

### Community 113 - "Решение"
Cohesion: 0.06
Nodes (36): GET(), LlmSettings, HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов (+28 more)

### Community 114 - "session-store.ts"
Cohesion: 0.25
Nodes (8): createAgentHistoryStore(), HistoryDb, sumKnown(), sumUsage(), totals, agentSessionStoreFor(), Connection, createAgentSessionStore()

### Community 116 - "works/api/queries.ts"
Cohesion: 0.12
Nodes (17): useWorkEvents(), WorkLive, documentPackageKeys, workKeys, workDeletionQueryOptions(), workQueryOptions(), loadErrorText(), useWorkView() (+9 more)

### Community 117 - "ref_react"
Cohesion: 0.08
Nodes (36): documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer(), Mode, PaperSkeleton() (+28 more)

### Community 118 - "modules/documents/index.ts"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 119 - "Примеры v2"
Cohesion: 0.22
Nodes (9): C1, C2, C3, C4, C5, C6, C7, C8 (+1 more)

### Community 120 - "documents/endpoints.ts"
Cohesion: 0.11
Nodes (20): cursorResponseSchema(), deleteDocument, documentParams, formatList, getDocumentDeletion, getDocumentDeletionImpact, getDocumentImage, getDocumentResult (+12 more)

### Community 121 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "document-values/package.json"
Cohesion: 0.13
Nodes (14): devDependencies, @anyko/typescript-config, typescript, @typescript/native, exports, ./calendar-date, @anyko/typescript-config, typescript (+6 more)

### Community 124 - "update-recognition.ts"
Cohesion: 0.23
Nodes (13): finishSourceChange(), workSourceLimit, attachDocuments(), requireCatalogSelection(), resolveCatalogSelection(), createWork(), createWorkIntake(), removeDocument() (+5 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "ProcessingIo"
Cohesion: 0.22
Nodes (6): Единый механизм запусков, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Выкат общего каталога (#44), IoSubject, ProcessingIo

### Community 128 - "agents/index.ts"
Cohesion: 0.07
Nodes (27): Контрольные примеры для reviewer, AgentDecision, AgentHistoryRef, AgentHistoryStore, AgentInteraction, AgentRunHistory, AgentRunRef, AgentStage (+19 more)

### Community 129 - "engineering/README.md"
Cohesion: 0.19
Nodes (4): graphify, Один модульный монолит с отдельными процессами, Ключ v2, Пробный прогон v1 — 5 ноября 2026

### Community 130 - "connection-settings.tsx"
Cohesion: 0.07
Nodes (45): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), llmSettingsQueryOptions() (+37 more)

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.06
Nodes (24): actualPool, agents, apiBackend, availabilityCases, Command, commands, create(), db (+16 more)

### Community 133 - "connections/api/mutations.ts"
Cohesion: 0.33
Nodes (6): connectionKeys, LlmSettingsInput, refreshLlmSettings(), useRevokeLlmSettings(), useSaveLlmSettings(), getLlmSettings

### Community 134 - "202611050006_uncertain_writes/migration.sql"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "documents.test.ts"
Cohesion: 0.04
Nodes (45): SourceStorage, createSourceCleanup(), connectionApi(), db, encryptionKey, owned, pool, settingsBackends (+37 more)

### Community 136 - "202611050011_bankruptcy_package_v3/migration.sql"
Cohesion: 0.13
Nodes (14): Completion criterion: a tight loop that goes red, Diagnosing Bugs, Minimise, Non-deterministic bugs, Phase 1: Build a feedback loop, Phase 2: Reproduce + minimise, Phase 3: Hypothesise, Phase 4: Instrument (+6 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "facts/index.ts"
Cohesion: 0.10
Nodes (37): acceptRunCandidates(), Candidate, ref, runFacts(), confirmValues(), editValues(), readAnalysisFacts(), readFacts() (+29 more)

### Community 140 - "call.ts"
Cohesion: 0.06
Nodes (42): Интерфейс, BodyField, CallArgs, callFileApi(), CallOptions, encodeBody(), FileEndpoint, fillPath() (+34 more)

### Community 141 - "routes/works/index.ts"
Cohesion: 0.14
Nodes (29): ApiInput, AppOptions, RouteEnv, ConnectionHttpOptions, imageHeaders(), imageIndex(), sourceFileHeaders(), DocumentHttpOptions (+21 more)

### Community 142 - "fingerprintInput"
Cohesion: 0.38
Nodes (4): canonicalize(), fingerprintInput(), ADR-0009, ADR-0009

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "access.test.ts"
Cohesion: 0.12
Nodes (13): ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, revokeLlmSettings, saveLlmSettings, ADR-0009, llmSettingsInputSchema (+5 more)

### Community 145 - "support/endpoints.ts"
Cohesion: 0.17
Nodes (12): contractModules, describedEndpoints(), namedEndpoints(), isEndpoint(), apiCatalogIsCurrent(), catalogFile, renderApiCatalog(), documents (+4 more)

### Community 146 - "build-windows-portable.mjs"
Cohesion: 0.33
Nodes (3): env, lock, root

### Community 147 - "openapi.ts"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "continue-session.ts"
Cohesion: 0.19
Nodes (18): DocumentAnalysis, WorkAttempt, requirePackage(), failureOf(), isAppError(), ContinuationSource, createWorkContinuation(), createWorkAnalysis() (+10 more)

### Community 150 - "HTML Report Format"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 152 - "diagnostic-worker.test.ts"
Cohesion: 0.10
Nodes (18): parseBackendEnv(), schema, parseWorkerConfig(), schema, startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime() (+10 more)

### Community 153 - "start-api.ts"
Cohesion: 0.10
Nodes (21): BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool(), DatabasePool (+13 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (10): reset(), Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы (+2 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.24
Nodes (15): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), Candidate, checksum(), digits(), mentions() (+7 more)

### Community 159 - "pdf_ocr.py"
Cohesion: 0.23
Nodes (15): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_image_lines(), read_lines() (+7 more)

### Community 160 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (17): This is NOT the Next.js you know, Архитектура, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система (+9 more)

### Community 161 - "runtime/jobs.ts"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - "smoke-windows-mineru.mjs"
Cohesion: 0.18
Nodes (15): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+7 more)

### Community 163 - "ui/src/index.ts"
Cohesion: 0.06
Nodes (50): SelectedCatalogFiles(), DocumentRow(), labels, tones, LinkedWorks(), DocumentRetryButton(), Files(), Generation (+42 more)

### Community 166 - "202611170016_generation_connection_revision/migration.sql"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.14
Nodes (13): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+5 more)

### Community 168 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 169 - "Triage"
Cohesion: 0.07
Nodes (25): Bad agent brief, Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Examples, Explicit scope boundaries, Good agent brief (bug), Good agent brief (enhancement) (+17 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 175 - "templates/index.ts"
Cohesion: 0.06
Nodes (45): generateDocument(), bankruptcyPackage, fourthPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), thirdPackage (+37 more)

### Community 177 - "audit/index.ts"
Cohesion: 0.16
Nodes (11): AuditModule, input, currentConnection(), LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection() (+3 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "document-values/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/library.json

### Community 181 - "writing-for-agents/SKILL.md"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "wayfinder/SKILL.md"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - "@tanstack/react-query"
Cohesion: 0.26
Nodes (10): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+2 more)

### Community 185 - "server/session.test.ts"
Cohesion: 0.25
Nodes (6): 1. Scope the procedure, 2. Map each stage's journey, 3. Author the wizard, 4. Verify and hand off, Process, Wizard

### Community 188 - "Triage"
Cohesion: 0.29
Nodes (10): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx, "WorkAgentEvent" (+2 more)

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "ProcessingIo"
Cohesion: 0.20
Nodes (10): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Единые таблицы запусков, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание (+2 more)

### Community 192 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 193 - "WorksModule"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 195 - "job-scope.ts"
Cohesion: 0.22
Nodes (8): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, issueExecutionScope(), envelope, setup()

### Community 196 - ""WorkDocument""
Cohesion: 0.24
Nodes (9): "WorkDocument", WorkDocument_workspaceId_documentId_key, WorkDocument_workspaceId_workId_idx, "ReadyDocumentRun", WorkDocument_workspaceId_documentId_idx, WorkDocument_workspaceId_workId_uploadGroupId_idx, "WorkUploadGroup", WorkUploadGroup_dispatchedAt_id_idx (+1 more)

### Community 198 - "ProcessorReview"
Cohesion: 0.15
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "work-view/index.ts"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 216 - "grilling/SKILL.md"
Cohesion: 0.33
Nodes (4): "IdempotencyKey", IdempotencyKey_expiresAt_idx, IdempotencyKey_resource_idx, IdempotencyKey_resource_documents_idx

### Community 217 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 218 - "implement/SKILL.md"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 219 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 220 - "wait-what/SKILL.md"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 223 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 231 - "Каталог HTTP API"
Cohesion: 0.50
Nodes (4): catalog, connections, session, Каталог HTTP API

### Community 235 - "ExecutionScope"
Cohesion: 0.15
Nodes (7): RenderBoundary, Фоновые задания, Задания, JobRegistry, parseJobEnvelope(), context, ExecutionScope

### Community 237 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 241 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

## Knowledge Gaps
- **155 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+150 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1891 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `works/schemas.ts` to `http/route.ts`, `routes/works/index.ts`, `Решение`, `Первая вертикаль обработки документов`, `LogReaderTests`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _155 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `package.json` to `journeys.spec.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._