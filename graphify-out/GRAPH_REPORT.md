# Graph Report - anyko  (2026-11-19)

## Corpus Check
- 813 files · ~368,972 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 4682 nodes · 12240 edges · 228 communities (188 shown, 40 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 274 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `367cf0ac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- ref_zod
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- @tanstack/react-query
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
- documents/endpoints.ts
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
- connections/api/mutations.ts
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
- work-list.test.tsx
- start.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
- Инженерная основа Anyko
- @tanstack/react-query
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- portable_shutdown.py
- bfl/fields.ts
- dependencies
- database/README.md
- Processor
- devDependencies
- @tanstack/react-query
- src/catalog/index.ts
- scripts
- openapi.ts
- Устройство репозитория
- architecture.md
- Button
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
- journey.test.ts
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- src/session/index.ts
- Runtime и диагностика
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- ref_bun_test
- endpoint.ts
- workspace-states.tsx
- RunDefinition
- src/works/index.ts
- ref_node_fs
- create-backend.ts
- application/chat.ts
- exports
- WorkspaceScope
- processing/index.ts
- database/src/index.ts
- app.ts
- llm/tsconfig.json
- modules/documents/index.ts
- unit-of-work.test.ts
- Решение
- Tx
- DocumentStore
- facts-form.test.tsx
- ref_react
- modules/documents/index.ts
- Примеры v2
- continue-session.ts
- 202611170017_unified_processing/migration.sql
- document-values/package.json
- build-windows-web.mjs
- WorkspaceScope
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- Feature-based web и модульный backend с ports/adapters
- ref_zod
- engineering/README.md
- restore-windows-web-links.mjs
- "AnykoWorkspace"
- works.test.ts
- money.ts
- 202611050006_uncertain_writes/migration.sql
- facts-form.ts
- 202611050011_bankruptcy_package_v3/migration.sql
- ui/package.json
- Язык Anyko
- values.ts
- catalog/schemas.ts
- routes/works/index.ts
- fingerprintInput
- 202611060012_work_agent_sessions/migration.sql
- connection-settings.tsx
- check-project.mjs
- llm/src/index.ts
- openapi.ts
- frontend.js
- package-preview.test.tsx
- HTML Report Format
- Размещение основы в Dokploy
- diagnostic-worker.test.ts
- runtime/index.ts
- setup.ts
- Решение
- support/endpoints.ts
- fieldErrors
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
- chat-model.ts
- Направления развития Anyko
- e2e/tsconfig.json
- templates/index.ts
- audit/index.ts
- ui/tsconfig.json
- document-values/tsconfig.json
- .test_two_matching_readings_preserve_number_and_a_conflict_is_excluded
- writing-for-agents/SKILL.md
- wayfinder/SKILL.md
- @tanstack/react-query
- server/config.ts
- server/session.test.ts
- session-gate.ts
- GenerationStore
- Triage
- "SourceDocument"
- stage-windows-web.mjs
- ProcessingIo
- ref_node_path
- WorksModule
- document-deletion.test.ts
- "WorkDocument"
- work-list.test.tsx
- ProcessorReview
- test_processor.py
- DocumentId
- hitl-loop.template.sh
- work-view/index.ts
- Sections
- Process
- work-review/edit-values.ts
- grilling/SKILL.md
- Agent skills
- smoke-windows-mineru.mjs
- wait-what/SKILL.md
- scripts
- Проверка тестов, написанных агентом
- Каталог HTTP API
- result-preview.tsx
- devDependencies
- "DocumentIo"

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 107 edges
2. `Button()` - 102 edges
3. `createBackend()` - 90 edges
4. `scripts` - 64 edges
5. `WorkId` - 57 edges
6. `callApi()` - 56 edges
7. `Tx` - 56 edges
8. `@tanstack/react-query` - 54 edges
9. `Notice()` - 52 edges
10. `WorkError` - 42 edges

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

## Communities (228 total, 40 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (24): @anyko/contracts, @anyko/document-values, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form (+16 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.16
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "ref_zod"
Cohesion: 0.07
Nodes (38): Последствия, Фоновые задания, Задания, idempotencyCleanupJob(), createIdempotencyMaintenance(), IdempotencyMaintenanceStore, createJobProcessing(), JobRunReader (+30 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "@tanstack/react-query"
Cohesion: 0.16
Nodes (32): RecognitionPage(), invalidateDocumentCatalog(), unavailableCatalogFiles(), recognitionRetryCode, CatalogSelection(), SelectedCatalogFiles(), DocumentWorkspace(), DocumentPicker() (+24 more)

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
Cohesion: 0.12
Nodes (20): actions, address(), boundedDirectories, collections, declaredOverlaps, entries, Entry, globals (+12 more)

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
Cohesion: 0.10
Nodes (46): Контекст, works, WorkError, WorkSourceRow, WorkSources, ChangeContext, changeWork(), finishSourceChange() (+38 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "documents/endpoints.ts"
Cohesion: 0.06
Nodes (33): healthResponseSchema, cursor, cursorQuery(), cursorQuerySchema, cursorResponseSchema(), ListMode, listQueries, listResponses (+25 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Issue tracker: GitHub"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.06
Nodes (43): RouteEnv, memoryIdempotency(), Row, AcquireInput, AcquireOutcome, CommandResponse, CreatedResource, IdempotencyKeyRef (+35 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "routes.ts"
Cohesion: 0.11
Nodes (22): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), ShellFrame() (+14 more)

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
Cohesion: 0.13
Nodes (25): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+17 more)

### Community 38 - "connections/api/mutations.ts"
Cohesion: 0.19
Nodes (12): connectionKeys, LlmSettingsInput, refreshLlmSettings(), useRevokeLlmSettings(), useSaveLlmSettings(), getLlmSettings, revokeLlmSettings, saveLlmSettings (+4 more)

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
Cohesion: 0.10
Nodes (19): @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+11 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "api/errors.ts"
Cohesion: 0.06
Nodes (39): Интерфейс, dynamic, relay(), documentTexts, conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord() (+31 more)

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
Nodes (27): record(), Connection, createDocumentCommands(), lockLiveDocumentForResponse(), Registration, createDocumentReadModel(), legacyPdf(), view() (+19 more)

### Community 52 - "ids.ts"
Cohesion: 0.14
Nodes (22): access, member, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor(), AccessOptions (+14 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "work-list.test.tsx"
Cohesion: 0.21
Nodes (9): configured, json(), renderSettings(), serveSaveAnswer(), serveSettings(), sessionWith(), Settings, expectFocused() (+1 more)

### Community 55 - "start.ts"
Cohesion: 0.08
Nodes (23): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, config, db, pool, redis (+15 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.17
Nodes (10): HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости, Вывод, Два разных контракта, Практический вариант для Anyko, Что проверено, Контракт процессора, Локальный stateless MinerU (+2 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "@tanstack/react-query"
Cohesion: 0.15
Nodes (19): manrope, metadata, onest, RootLayout(), Providers(), WorkspaceLayout(), AppShell(), renderShell() (+11 more)

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

### Community 65 - "bfl/fields.ts"
Cohesion: 0.12
Nodes (18): agentSessionContextSchema, agentSessionSchema, AcceptedRunCandidates, candidateBaseSchema, extractedCandidateSchema, collectionLabels, dateFields, FieldKey (+10 more)

### Community 66 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+7 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "@tanstack/react-query"
Cohesion: 0.07
Nodes (55): RecognitionAction, requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion(), documentKeys (+47 more)

### Community 73 - "src/catalog/index.ts"
Cohesion: 0.21
Nodes (21): mentions(), previewEntries(), PackagePreview(), Props, zooms, CollectionNote(), paperMargins(), paragraphStyle() (+13 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "openapi.ts"
Cohesion: 0.30
Nodes (10): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), errorCodeSchema (+2 more)

### Community 76 - "Устройство репозитория"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 77 - "architecture.md"
Cohesion: 0.15
Nodes (7): Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Выводы агента, продолжение анализа и форматы подстановки

### Community 78 - "Button"
Cohesion: 0.04
Nodes (94): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), WorkScreen() (+86 more)

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
Nodes (52): fieldKeySchema, pageResponseSchema(), agentHistoryEvent, AgentHistoryPage, AgentHistoryRunPage, count, tokens, usage (+44 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "transactions/index.ts"
Cohesion: 0.05
Nodes (50): documentOcrPolicy, activeAttempt(), claimRun(), finishRun(), NotifyDocumentRun, recoverRuns(), RecoveryPolicy, RunConnection (+42 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.09
Nodes (26): createApp(), authRoutes(), ConnectionHttpOptions, WorkHttpOptions, Analyze, appWith(), run(), withServer() (+18 more)

### Community 88 - "audit/index.ts"
Cohesion: 0.26
Nodes (9): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+1 more)

### Community 89 - "journey.test.ts"
Cohesion: 0.29
Nodes (3): run(), view(), availableWorkCommands

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "src/session/index.ts"
Cohesion: 0.16
Nodes (9): Call, session, getSession, Right, rights, rightSchema, ADR-0009, membershipSchema (+1 more)

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
Cohesion: 0.25
Nodes (15): renderWork(), source, result, serveWork(), installEventSource(), json(), networkError, serveApi() (+7 more)

### Community 98 - "endpoint.ts"
Cohesion: 0.11
Nodes (19): HTTP, EndpointSpec, endpointTag, EventsResponse, eventStream(), fileDownload(), FileResponse, Idempotency (+11 more)

### Community 99 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 100 - "RunDefinition"
Cohesion: 0.14
Nodes (25): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkEvent" (+17 more)

### Community 101 - "src/works/index.ts"
Cohesion: 0.05
Nodes (77): chatKey(), chatMessagesQuery(), useSendChatMessage(), useWorkEvents(), WorkLive, useGenerateWork(), documentPackageKeys, workKeys (+69 more)

### Community 102 - "ref_node_fs"
Cohesion: 0.12
Nodes (9): { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, components, env, root (+1 more)

### Community 103 - "create-backend.ts"
Cohesion: 0.06
Nodes (50): createAgentChatStore(), createAgentHistoryStore(), agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), createAuditModule(), Connection (+42 more)

### Community 104 - "application/chat.ts"
Cohesion: 0.08
Nodes (23): AgentFieldChange, AgentFieldReceipt, AgentTimelineEntry, ChatRef, ChatSessionRef, fieldChangeSchema, fieldWriteSchema, fieldWriteTool (+15 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "WorkspaceScope"
Cohesion: 0.06
Nodes (26): activeDocument(), attachDocuments(), createWork(), failureOf(), findWork(), listEvents(), listWorks(), notifyDocumentChanged() (+18 more)

### Community 107 - "processing/index.ts"
Cohesion: 0.05
Nodes (36): Единый механизм запусков, Единые таблицы запусков, Восстановление и данные, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Выкат общего каталога (#44), Начальная топология, Порядок выпуска (+28 more)

### Community 108 - "database/src/index.ts"
Cohesion: 0.07
Nodes (32): BackendDependencies, countingSeams(), changeDeps, config, db, failing, failureOf(), lockPool (+24 more)

### Community 109 - "app.ts"
Cohesion: 0.07
Nodes (55): ApiInput, AppOptions, registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore() (+47 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "modules/documents/index.ts"
Cohesion: 0.05
Nodes (75): documents, currentConnection(), failed, queued, store(), unused(), listDocuments(), readPosition() (+67 more)

### Community 113 - "Решение"
Cohesion: 0.07
Nodes (31): GET(), LlmSettings, HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контракты, Модуль: фасад команд и запросов, Отвергнуто (+23 more)

### Community 114 - "Tx"
Cohesion: 0.14
Nodes (14): Candidate, ref, runFacts(), confirmValues(), editValues(), readAnalysisFacts(), readFacts(), AcceptRunCandidatesInput (+6 more)

### Community 116 - "facts-form.test.tsx"
Cohesion: 0.13
Nodes (13): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), serveWork(), viewWith() (+5 more)

### Community 117 - "ref_react"
Cohesion: 0.07
Nodes (43): WorkNotFound(), DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), recognitionRetryText, documentKind(), DocumentOriginal(), documentLinks() (+35 more)

### Community 118 - "modules/documents/index.ts"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 119 - "Примеры v2"
Cohesion: 0.22
Nodes (9): C1, C2, C3, C4, C5, C6, C7, C8 (+1 more)

### Community 120 - "continue-session.ts"
Cohesion: 0.13
Nodes (29): WorkspaceActorScope, DocumentAnalysis, candidatesForContext(), WorkAttempt, stepOutputSchema, ProcessingCommands, ProcessingPorts, WorkMaintenance (+21 more)

### Community 121 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "document-values/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @anyko/typescript-config, typescript, @typescript/native, exports, ./calendar-date, ./money, ./template-value (+8 more)

### Community 124 - "WorkspaceScope"
Cohesion: 0.09
Nodes (20): connections, Доверенный scope и права, DocumentsCommands, DocumentsQueries, FactsCommands, WorkRuns, ProcessingQueries, availablePackages() (+12 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 128 - "ref_zod"
Cohesion: 0.08
Nodes (21): Контрольные примеры для reviewer, AgentChatMessage, AgentChatStore, AgentFieldWrite, AgentToolEvent, AgentSessionStore, Reconciliation, reconciliationSchema (+13 more)

### Community 129 - "engineering/README.md"
Cohesion: 0.24
Nodes (3): graphify, Ключ v2, Пробный прогон v1 — 5 ноября 2026

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.06
Nodes (26): getWorkAgentHistory, write(), actualPool, agents, apiBackend, availabilityCases, Command, commands (+18 more)

### Community 133 - "money.ts"
Cohesion: 0.06
Nodes (47): invalidReviewValue(), normalizedReviewValue(), ReviewField, reviewFields(), ReviewFilter, CalendarDate, canonicalCalendarDate(), formatCalendarDate() (+39 more)

### Community 134 - "202611050006_uncertain_writes/migration.sql"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "facts-form.ts"
Cohesion: 0.16
Nodes (25): applyRevision(), draftForSave(), FactsDraft, FactsDraftEvent, FactsDraftTransition, FactsFormChange, FactsRevision, hasFactsDraftEdits() (+17 more)

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
Cohesion: 0.13
Nodes (37): acceptRunCandidates(), candidateIdentity(), combineCandidates(), Candidate, comparableFactValue(), comparableRow(), confirmFacts(), editFacts() (+29 more)

### Community 140 - "catalog/schemas.ts"
Cohesion: 0.17
Nodes (11): listDocumentPackages, DocumentTemplate, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema, previewCellSchema (+3 more)

### Community 141 - "routes/works/index.ts"
Cohesion: 0.29
Nodes (14): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), presentDocumentResult(), documentSummary(), workEventStream(), presentWork() (+6 more)

### Community 142 - "fingerprintInput"
Cohesion: 0.20
Nodes (10): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, canonicalize(), fingerprintInput() (+2 more)

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "connection-settings.tsx"
Cohesion: 0.07
Nodes (42): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), llmSettingsQueryOptions() (+34 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.15
Nodes (8): apiCatalogIsCurrent(), documents, errors, manifests, markdownFiles(), root, hook, root

### Community 146 - "llm/src/index.ts"
Cohesion: 0.07
Nodes (39): createChatAgent(), createWorkContextBudget(), fallback, Prompt, createDocumentAgents(), descriptionSchema, extractionSchema, transcriptionSchema (+31 more)

### Community 147 - "openapi.ts"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "package-preview.test.tsx"
Cohesion: 0.21
Nodes (9): pack, paragraph(), emptyFieldValues(), fieldDefinitions, FieldDefinition, fieldRowSchema, fieldValueSchema, fieldValuesSchema (+1 more)

### Community 150 - "HTML Report Format"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 152 - "diagnostic-worker.test.ts"
Cohesion: 0.08
Nodes (24): parseBackendEnv(), schema, parseWorkerConfig(), schema, startWorker(), dispatchOutbox(), reconcileJobs(), resultSchema (+16 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.05
Nodes (35): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), BackendConfig, BackendConfigErrorCode, backendConfigSchema (+27 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "support/endpoints.ts"
Cohesion: 0.33
Nodes (8): contractModules, describedEndpoints(), NamedEndpoint, namedEndpoints(), endpoint, isEndpoint(), catalogFile, renderApiCatalog()

### Community 158 - "fieldErrors"
Cohesion: 0.43
Nodes (6): codeOf(), FieldErrorCode, fieldErrors(), FieldIssue, segments(), valueAt()

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
Cohesion: 0.16
Nodes (16): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+8 more)

### Community 163 - "ui/src/index.ts"
Cohesion: 0.06
Nodes (58): WorkListPage(), recognitionFailureText(), unavailableReason(), DocumentRow(), labels, SelectionCheckbox(), tones, LinkedWorks() (+50 more)

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

### Community 170 - "chat-model.ts"
Cohesion: 0.40
Nodes (4): chatModelFetch, completionRequest, userMessage, values

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 175 - "templates/index.ts"
Cohesion: 0.08
Nodes (29): amountPackage, bankruptcyPackage, fourthPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), thirdPackage (+21 more)

### Community 177 - "audit/index.ts"
Cohesion: 0.09
Nodes (36): Как добавлять, Как проверяются правила, AgentsModule, AuditModule, input, LlmConfiguration, LlmSettingsStore, revokeConnection() (+28 more)

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

### Community 184 - "server/config.ts"
Cohesion: 0.40
Nodes (3): register(), schema, server-only

### Community 185 - "server/session.test.ts"
Cohesion: 0.25
Nodes (6): 1. Scope the procedure, 2. Map each stage's journey, 3. Author the wizard, 4. Verify and hand off, Process, Wizard

### Community 186 - "session-gate.ts"
Cohesion: 0.13
Nodes (14): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+6 more)

### Community 187 - "GenerationStore"
Cohesion: 0.10
Nodes (17): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationQueries, GenerationRecord (+9 more)

### Community 188 - "Triage"
Cohesion: 0.21
Nodes (13): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx, "WorkAgentEvent" (+5 more)

### Community 189 - ""SourceDocument""
Cohesion: 0.18
Nodes (10): "SourceDocument", SourceDocument_sourceKey_key, SourceDocument_workspaceId_createdAt_idx, SourceDocument_workspaceId_id_key, SourceDocument_workspaceId_requestKey_key, SourceDocument_deletedAt_purgedAt_idx, SourceDocument_active_filename_trgm_idx, SourceDocument_active_format_page_idx (+2 more)

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "ProcessingIo"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 192 - "ref_node_path"
Cohesion: 0.10
Nodes (12): config, assetTypes, child, metadata, mineru, path, python, root (+4 more)

### Community 193 - "WorksModule"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 194 - "document-deletion.test.ts"
Cohesion: 0.08
Nodes (17): documentLockKey(), ArtifactRegistry, DocumentParser, SourceStorage, documentResultSchema, StorageWriteOutcomeUnknown, createDocumentDeletionWorkflow(), failureCodes (+9 more)

### Community 196 - ""WorkDocument""
Cohesion: 0.24
Nodes (9): "WorkDocument", WorkDocument_workspaceId_documentId_key, WorkDocument_workspaceId_workId_idx, "ReadyDocumentRun", WorkDocument_workspaceId_documentId_idx, WorkDocument_workspaceId_workId_uploadGroupId_idx, "WorkUploadGroup", WorkUploadGroup_dispatchedAt_id_idx (+1 more)

### Community 197 - "work-list.test.tsx"
Cohesion: 0.15
Nodes (13): deletionImpactToken, renderWorkspace(), Status, createdWorkView, existingWork, json(), packages, renderWorkList() (+5 more)

### Community 198 - "ProcessorReview"
Cohesion: 0.15
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "work-view/index.ts"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 214 - "work-review/edit-values.ts"
Cohesion: 0.25
Nodes (12): confirmFacts(), EditDeps, EditRequest, editValues(), FieldChange, FieldEdit, parseValues(), restoreField() (+4 more)

### Community 216 - "grilling/SKILL.md"
Cohesion: 0.33
Nodes (4): "IdempotencyKey", IdempotencyKey_expiresAt_idx, IdempotencyKey_resource_idx, IdempotencyKey_resource_documents_idx

### Community 217 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

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

### Community 237 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 241 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 244 - ""DocumentIo""
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

## Knowledge Gaps
- **155 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+150 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1944 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `app.ts`, `routes/works/index.ts`, `fingerprintInput`, `Решение`, `LogReaderTests`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _155 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `session-gate.ts` to `package.json`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._