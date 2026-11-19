# Graph Report - anyko  (2026-11-19)

## Corpus Check
- 768 files · ~342,517 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 4372 nodes · 11318 edges · 218 communities (179 shown, 39 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 264 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0237d0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- documents/module.ts
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- Button
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
- change-work.ts
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
- Anyko — брендбук
- Logger
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- WorkspaceScope
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
- @tanstack/react-query
- facts-form.ts
- scripts
- documents/endpoints.ts
- Устройство репозитория
- work-pipeline.md
- documents.test.ts
- agent-github.mjs
- api/errors.ts
- boundaries.test.ts
- works/schemas.ts
- stage-windows-migrator.mjs
- transactions/index.ts
- dev.mjs
- devDependencies
- logger/src/index.ts
- unit-of-work.test.ts
- integration/idempotency.test.ts
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- catalog-deletion.ts
- Runtime и диагностика
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- ref_bun_test
- errors/index.ts
- workspace-states.tsx
- RunDefinition
- endpoint.ts
- ref_node_fs
- create-backend.ts
- bfl/fields.ts
- exports
- work-pipeline.tsx
- processing/index.ts
- start.ts
- app.ts
- llm/tsconfig.json
- modules/documents/index.ts
- unit-of-work.test.ts
- Решение
- agents/module.ts
- DocumentStore
- idempotency/jobs.ts
- document-viewer.tsx
- modules/documents/index.ts
- Примеры v2
- 202611170017_unified_processing/migration.sql
- build-windows-web.mjs
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- @tanstack/react-query
- DocumentAgents
- engineering/README.md
- connection-settings.tsx
- "AnykoWorkspace"
- works.test.ts
- 202611050006_uncertain_writes/migration.sql
- 202611050010_bankruptcy_package_v2/migration.sql
- 202611050011_bankruptcy_package_v3/migration.sql
- ui/package.json
- Язык Anyko
- values.ts
- call.ts
- routes/works/index.ts
- facts/module.ts
- 202611060012_work_agent_sessions/migration.sql
- access.test.ts
- check-project.mjs
- jobs/index.ts
- openapi.ts
- frontend.js
- facts/index.ts
- HTML Report Format
- diagnostic-worker.test.ts
- start-api.ts
- setup.ts
- Решение
- automatic-value.ts
- pdf_ocr.py
- client.ts
- runtime/jobs.ts
- smoke-windows-mineru.mjs
- ui/src/index.ts
- FakeEventSource
- 202611170016_generation_connection_revision/migration.sql
- black-hole-renderer.ts
- Triage
- Направления развития Anyko
- Размещение и эксплуатация
- e2e/tsconfig.json
- templates/schemas.ts
- audit/index.ts
- ui/tsconfig.json
- .test_two_matching_readings_preserve_number_and_a_conflict_is_excluded
- writing-for-agents/SKILL.md
- wayfinder/SKILL.md
- @tanstack/react-query
- server/session.test.ts
- generation/index.ts
- Triage
- stage-windows-web.mjs
- Данные, доступ и фоновые задания
- bootstrap.mjs
- WorksModule
- job-scope.ts
- WorkDeletionStore
- ProcessorReview
- test_processor.py
- DocumentId
- hitl-loop.template.sh
- work-view/index.ts
- Sections
- Process
- journeys.spec.ts
- grilling/SKILL.md
- Agent skills
- implement/SKILL.md
- smoke-windows-mineru.mjs
- wait-what/SKILL.md
- Размещение основы в Dokploy
- @tanstack/react-query
- Проверка тестов, написанных агентом
- scroll-sync.ts
- update-recognition.ts
- ExecutionScope
- result-preview.tsx
- WorkDeletionStore
- devDependencies
- scripts

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 105 edges
2. `Button()` - 90 edges
3. `createBackend()` - 86 edges
4. `scripts` - 64 edges
5. `WorkId` - 55 edges
6. `Tx` - 53 edges
7. `@tanstack/react-query` - 49 edges
8. `callApi()` - 48 edges
9. `Notice()` - 45 edges
10. `useWorkspaceId()` - 36 edges

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

## Communities (218 total, 39 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (33): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+25 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.16
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "documents/module.ts"
Cohesion: 0.29
Nodes (12): Фоновые задания, idempotencyCleanupJob(), defineJob(), JobRegistry, RunPolicy, ExecutionScope, createJobRegistry(), documentMaintenanceJob() (+4 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Button"
Cohesion: 0.07
Nodes (71): RecognitionPage(), WorkListPage(), invalidateDocumentCatalog(), unavailableCatalogFiles(), recognitionFailureText(), CatalogSelection(), unavailableReason(), SelectedCatalogFiles() (+63 more)

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
Cohesion: 0.16
Nodes (8): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query(), request()

### Community 11 - "api-design.test.ts"
Cohesion: 0.09
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

### Community 21 - "change-work.ts"
Cohesion: 0.09
Nodes (52): Контекст, AgentsModule, LlmSettingsInput, ConnectionErrors, ConnectionsModule, ResourceLocks, SourceStorage, DocumentsModule (+44 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "jobs/index.ts"
Cohesion: 0.12
Nodes (10): CommonDefinition, currentEnvelope, DeliveryPort, identity, JobDelivery, RetryPolicy, RunDefinition, ScheduledDefinition (+2 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Issue tracker: GitHub"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.08
Nodes (32): Row, HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, canonicalize() (+24 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "routes.ts"
Cohesion: 0.11
Nodes (21): config, LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage() (+13 more)

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
Cohesion: 0.07
Nodes (23): DocumentErrors, activeDocument(), attachDocuments(), createWork(), failureOf(), findWork(), listEvents(), listWorks() (+15 more)

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

### Community 41 - "processor.py"
Cohesion: 0.10
Nodes (15): image_png(), media_entries(), prepare_docx(), replace_missing_visuals(), erase(), health(), parse(), parse_source() (+7 more)

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

### Community 47 - "api/errors.ts"
Cohesion: 0.08
Nodes (43): revokeConnection(), conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), useGenerateWork(), invalidateWork(), renderCommands() (+35 more)

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
Cohesion: 0.14
Nodes (26): createDocumentCommands(), createDocumentReadModel(), legacyPdf(), view(), RunSummary, SourceSummary, statusSchema, createReadyResults() (+18 more)

### Community 52 - "ids.ts"
Cohesion: 0.16
Nodes (18): access, member, memberSession, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor() (+10 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (18): This is NOT the Next.js you know, Архитектура, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот (+10 more)

### Community 55 - "Logger"
Cohesion: 0.14
Nodes (17): ApiInput, AppOptions, RouteEnv, ConnectionHttpOptions, DocumentHttpOptions, WorkHttpOptions, ConnectionSettingsApi, IdempotencyApi (+9 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.17
Nodes (10): HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости, Вывод, Два разных контракта, Практический вариант для Anyko, Что проверено, Контракт процессора, Локальный stateless MinerU (+2 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "WorkspaceScope"
Cohesion: 0.07
Nodes (30): connections, Доверенный scope и права, LlmConfiguration, DocumentDeletionImpact, DocumentsCommands, DocumentsQueries, confirmValues(), editValues() (+22 more)

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
Cohesion: 0.11
Nodes (20): reconciliationSchema, createDocumentAgents(), descriptionSchema, extractionSchema, transcriptionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse() (+12 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "@tanstack/react-query"
Cohesion: 0.08
Nodes (51): RecognitionAction, requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion(), documentKeys (+43 more)

### Community 73 - "facts-form.ts"
Cohesion: 0.07
Nodes (67): applyRevision(), draftForSave(), FactsDraft, FactsDraftEvent, FactsDraftTransition, FactsFormChange, FactsRevision, hasFactsDraftEdits() (+59 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "documents/endpoints.ts"
Cohesion: 0.07
Nodes (29): healthResponseSchema, cursor, cursorQuery(), cursorQuerySchema, cursorResponseSchema(), ListMode, listQueries, listResponses (+21 more)

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "work-pipeline.md"
Cohesion: 0.29
Nodes (3): Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток

### Community 78 - "documents.test.ts"
Cohesion: 0.09
Nodes (22): createSourceCleanup(), fixture(), workspaceWithWork(), memberScope(), startDocumentWorker(), api, contentTypes, db (+14 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "api/errors.ts"
Cohesion: 0.21
Nodes (4): deleteCatalogDocument(), DeletionPorts, ImpactPorts, readDeletionImpact()

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "works/schemas.ts"
Cohesion: 0.05
Nodes (48): listDocumentPackages, fieldKeySchema, fieldValueSchema, fieldValuesSchema, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema (+40 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "transactions/index.ts"
Cohesion: 0.07
Nodes (44): claimDocumentAttempt(), isActive(), listRuns(), DocumentAttemptStore, DocumentRunOutcome, DocumentRunSnapshot, claimRunAttempt(), RunClaim (+36 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.09
Nodes (24): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), createApp(), authRoutes(), Analyze (+16 more)

### Community 88 - "unit-of-work.test.ts"
Cohesion: 0.14
Nodes (13): changeDeps, config, db, failing, failureOf(), lockPool, logger, normal (+5 more)

### Community 89 - "integration/idempotency.test.ts"
Cohesion: 0.11
Nodes (25): Connection, lockLiveDocumentForResponse(), Registration, createIdempotencyStore(), idempotencyStoreFor(), redactResourceResponses(), createWorkDeletionStore(), lockLiveWorkForResponse() (+17 more)

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "catalog-deletion.ts"
Cohesion: 0.21
Nodes (10): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+2 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.13
Nodes (8): descendant_handles(), initdb_diagnostic(), ModelHandler, start(), child(), dead(), main(), supervisor()

### Community 95 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "ref_bun_test"
Cohesion: 0.07
Nodes (44): renderWork(), source, result, deletionImpactToken, Status, fieldNamed(), observations(), pack (+36 more)

### Community 98 - "errors/index.ts"
Cohesion: 0.29
Nodes (8): codeOf(), FieldError, FieldErrorCode, fieldErrors(), FieldIssue, segments(), valueAt(), ErrorKind

### Community 99 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 100 - "RunDefinition"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 101 - "endpoint.ts"
Cohesion: 0.09
Nodes (29): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+21 more)

### Community 102 - "ref_node_fs"
Cohesion: 0.07
Nodes (16): assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, env, lock (+8 more)

### Community 103 - "create-backend.ts"
Cohesion: 0.07
Nodes (35): agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), record(), createAuditModule(), Connection, connectionsStoreFor() (+27 more)

### Community 104 - "bfl/fields.ts"
Cohesion: 0.18
Nodes (11): templateData(), collectionLabels, emptyFieldValues(), FieldRow, fieldRowSchema, FieldValue, fieldValueSchema, obligationColumns (+3 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "work-pipeline.tsx"
Cohesion: 0.08
Nodes (41): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), WorkScreen(), analysisRuns() (+33 more)

### Community 107 - "processing/index.ts"
Cohesion: 0.06
Nodes (28): Единый механизм запусков, Единые таблицы запусков, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Выкат общего каталога (#44), pdf, DocumentAttempt, documentOcrPolicy (+20 more)

### Community 108 - "start.ts"
Cohesion: 0.09
Nodes (22): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, config, db, pool, redis (+14 more)

### Community 109 - "app.ts"
Cohesion: 0.08
Nodes (50): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+42 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "modules/documents/index.ts"
Cohesion: 0.05
Nodes (70): deleteDocument(), documents, failed, queued, store(), unused(), documentLockKey(), listDocuments() (+62 more)

### Community 113 - "Решение"
Cohesion: 0.07
Nodes (34): GET(), LlmSettings, HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контракты, Модуль: фасад команд и запросов, Отвергнуто (+26 more)

### Community 114 - "agents/module.ts"
Cohesion: 0.36
Nodes (4): AgentSessionStore, AgentsPorts, AgentsDeps, AgentSession

### Community 117 - "document-viewer.tsx"
Cohesion: 0.09
Nodes (34): DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), recognitionRetryText, documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer() (+26 more)

### Community 118 - "modules/documents/index.ts"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 119 - "Примеры v2"
Cohesion: 0.15
Nodes (12): C1, C2, C3, C4, C5, C6, C7, C8 (+4 more)

### Community 121 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "@tanstack/react-query"
Cohesion: 0.07
Nodes (42): manrope, metadata, onest, RootLayout(), Providers(), WorkspaceLayout(), AppShell(), ShellFrame() (+34 more)

### Community 128 - "DocumentAgents"
Cohesion: 0.31
Nodes (3): DocumentAgents, FieldDefinition, ModelConnection

### Community 129 - "engineering/README.md"
Cohesion: 0.16
Nodes (9): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web (+1 more)

### Community 130 - "connection-settings.tsx"
Cohesion: 0.06
Nodes (50): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), connectionKeys (+42 more)

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.07
Nodes (24): actualPool, agents, apiBackend, availabilityCases, Command, commands, create(), db (+16 more)

### Community 134 - "202611050006_uncertain_writes/migration.sql"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "202611050010_bankruptcy_package_v2/migration.sql"
Cohesion: 0.06
Nodes (27): createS3Storage(), BackendConfig, BackendConfigError, BackendConfigErrorCode, backendConfigSchema, encryptionKey, httpUrl, postgresUrl (+19 more)

### Community 136 - "202611050011_bankruptcy_package_v3/migration.sql"
Cohesion: 0.13
Nodes (14): Completion criterion: a tight loop that goes red, Diagnosing Bugs, Minimise, Non-deterministic bugs, Phase 1: Build a feedback loop, Phase 2: Reproduce + minimise, Phase 3: Hypothesise, Phase 4: Instrument (+6 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "values.ts"
Cohesion: 0.23
Nodes (18): acceptRunCandidates(), combineCandidates(), Candidate, comparableFactValue(), confirmFacts(), editFacts(), FactEvidence, findFactDiscrepancies() (+10 more)

### Community 140 - "call.ts"
Cohesion: 0.06
Nodes (45): useWorkEvents(), WorkLive, loadErrorText(), useWorkView(), BodyField, CallArgs, callFileApi(), CallOptions (+37 more)

### Community 141 - "routes/works/index.ts"
Cohesion: 0.10
Nodes (32): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), presentDocumentResult(), documentSummary(), workEventStream(), presentWork() (+24 more)

### Community 142 - "facts/module.ts"
Cohesion: 0.11
Nodes (9): Candidate, ref, runFacts(), readAnalysisFacts(), readFacts(), FactsStore, createFactsModule(), FactsDeps (+1 more)

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "access.test.ts"
Cohesion: 0.17
Nodes (9): revokeLlmSettings, ADR-0009, llmSettingsInputSchema, llmSettingsResponseSchema, savedStatusSchema, workResponseSchema, delete(), get() (+1 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 146 - "jobs/index.ts"
Cohesion: 0.17
Nodes (12): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Задания, JobRuntime, parseJobEnvelope(), parseWorkerQueues() (+4 more)

### Community 147 - "openapi.ts"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "facts/index.ts"
Cohesion: 0.08
Nodes (40): Reconciliation, AgentDocument, AgentUsage, visionPromptRevision, AgentSessionContext, agentSessionContextSchema, agentSessionSchema, WorkFacts (+32 more)

### Community 150 - "HTML Report Format"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 152 - "diagnostic-worker.test.ts"
Cohesion: 0.11
Nodes (14): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime(), envelope (+6 more)

### Community 153 - "start-api.ts"
Cohesion: 0.10
Nodes (21): BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool(), DatabasePool (+13 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (10): reset(), Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы (+2 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.21
Nodes (16): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), Candidate, checksum(), date(), dateFields (+8 more)

### Community 159 - "pdf_ocr.py"
Cohesion: 0.23
Nodes (15): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_image_lines(), read_lines() (+7 more)

### Community 160 - "client.ts"
Cohesion: 0.12
Nodes (17): dynamic, relay(), register(), HttpFetch, request(), requestApi(), requestApiFile(), RequestOptions (+9 more)

### Community 161 - "runtime/jobs.ts"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - "smoke-windows-mineru.mjs"
Cohesion: 0.23
Nodes (12): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+4 more)

### Community 163 - "ui/src/index.ts"
Cohesion: 0.07
Nodes (30): DocumentSelectionActions(), labels, SelectionCheckbox(), tones, LinkedWorks(), FactsEditor(), UnsavedNavigation(), Size (+22 more)

### Community 166 - "202611170016_generation_connection_revision/migration.sql"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.14
Nodes (13): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+5 more)

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

### Community 175 - "templates/schemas.ts"
Cohesion: 0.12
Nodes (18): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), thirdPackage, block, cell (+10 more)

### Community 177 - "audit/index.ts"
Cohesion: 0.13
Nodes (18): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditModule, AuditConnection (+10 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 181 - "writing-for-agents/SKILL.md"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "wayfinder/SKILL.md"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - "@tanstack/react-query"
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 185 - "server/session.test.ts"
Cohesion: 0.25
Nodes (6): 1. Scope the procedure, 2. Map each stage's journey, 3. Author the wizard, 4. Verify and hand off, Process, Wizard

### Community 187 - "generation/index.ts"
Cohesion: 0.11
Nodes (16): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationRecord, GenerationStore (+8 more)

### Community 188 - "Triage"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 192 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 193 - "WorksModule"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 195 - "job-scope.ts"
Cohesion: 0.19
Nodes (8): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, issueExecutionScope(), envelope, setup()

### Community 198 - "ProcessorReview"
Cohesion: 0.15
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "work-view/index.ts"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 215 - "journeys.spec.ts"
Cohesion: 0.50
Nodes (3): ObservedEventSource, required(), signIn()

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

### Community 221 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 222 - "@tanstack/react-query"
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

### Community 223 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 224 - "scroll-sync.ts"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 231 - "update-recognition.ts"
Cohesion: 0.16
Nodes (19): catalog, connections, session, works, Каталог HTTP API, finishSourceChange(), workSourceLimit, analyzeWork() (+11 more)

### Community 235 - "ExecutionScope"
Cohesion: 0.29
Nodes (5): RenderBoundary, Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 237 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 241 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1811 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `idempotency/index.ts`, `app.ts`, `routes/works/index.ts`, `Решение`, `LogReaderTests`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `package.json` to `journeys.spec.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._