# Graph Report - issue-33-work-change  (2026-11-18)

## Corpus Check
- 714 files · ~311,781 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 7, .ttf 5, .example 4)

## Summary
- 4117 nodes · 10107 edges · 220 communities (188 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 245 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32ea2ef5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- run-local.test.mjs
- work-screen.tsx
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- src/works/index.ts
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
- modules/works/index.ts
- exports
- web/tsconfig.json
- work-list.tsx
- Проверка качества
- Process
- idempotency/index.ts
- logger/package.json
- app-shell.tsx
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- transactions/index.ts
- ids.ts
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- client.ts
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- database/src/index.ts
- access/index.ts
- llm/package.json
- audit/index.ts
- 202611050001_document_vertical/migration.sql
- Issue tracker: GitHub
- MinerU и RouterAI: граница совместимости
- Инженерная основа Anyko
- engineering/README.md
- contracts/tsconfig.json
- database/tsconfig.json
- scripts/tsconfig.json
- integration/tsconfig.json
- tempfile
- mastra.ts
- dependencies
- database/README.md
- .run
- devDependencies
- document-workspace.tsx
- works/endpoints.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- 202611050007_work_pipeline/migration.sql
- agent-github.mjs
- document-deletion.test.ts
- boundaries.test.ts
- 202611170017_unified_processing/migration.sql
- stage-windows-migrator.mjs
- processing/index.ts
- dev.mjs
- devDependencies
- logger/src/index.ts
- connection-settings.tsx
- modules/documents/index.ts
- teach/SKILL.md
- LogReaderTests
- documents/application/ports.ts
- Runtime и диагностика
- smoke-windows-release.py
- Codebase Design
- stage-windows-mineru.mjs
- mutations.test.tsx
- agents/index.ts
- Anyko — брендбук
- work-pipeline.tsx
- http/route.ts
- works/api/mutations.ts
- create-backend.ts
- ui/src/index.ts
- exports
- ref_bun_test
- call.ts
- start.ts
- app.ts
- llm/tsconfig.json
- bfl/fields.ts
- smoke-windows-mineru.mjs
- Решение
- facts-form.test.tsx
- check-project.mjs
- Logger
- workspace-states.tsx
- ProcessingIo
- Примеры v2
- Agent skills
- During the session
- session-gate.ts
- build-windows-web.mjs
- transactionHandle
- deep-sky.ts
- HTML Report Format
- endpoint.ts
- templates/index.ts
- server/config.ts
- api/errors.ts
- template.sh
- works.test.ts
- "AnykoWorkspace"
- Ask Matt
- upload.ts
- Diagnosing Bugs
- ui/package.json
- Язык Anyko
- document-viewer.tsx
- result-preview.tsx
- Работа агентов и независимая проверка
- automatic-value.ts
- Test-Driven Development
- connections/endpoints.ts
- DocumentId
- documents/application/ports.ts
- Process
- eslint.config.mjs
- continue-session.ts
- writing-for-agents/SKILL.md
- modules/connections/index.ts
- callApi
- runtime/index.ts
- setup.ts
- Решение
- routes/works/index.ts
- EventHorizon
- pdf_ocr.py
- work-list.test.tsx
- wayfinder/SKILL.md
- ref_node_fs
- @tanstack/react-query
- documents/application/commands.test.ts
- support/endpoints.ts
- to-spec/SKILL.md
- black-hole-renderer.ts
- fingerprintInput
- Triage
- "WorkGeneration"
- Направления развития Anyko
- architecture.md
- ref_node_path
- e2e/tsconfig.json
- DeliveryPort
- use-work-view.ts
- job-host.test.ts
- ui/tsconfig.json
- 202611060012_work_agent_sessions/migration.sql
- PdfRecoveryReview
- Process
- <Questionnaire title>
- Feature-based web и модульный backend с ports/adapters
- connection-settings.test.tsx
- Process
- Данные, доступ и фоновые задания
- src/session/index.ts
- Web-приложение
- bootstrap.mjs
- stage-windows-web.mjs
- Каталог HTTP API
- WorkDeletionStore
- Sections
- 202611180018_work_deletion_and_listing/migration.sql
- [file]/route.ts
- documents/application/commands.test.ts
- "DocumentIo"
- ProcessorReview
- VisualExportReview
- jobs/index.ts
- Anyko
- WorkspaceScope
- hitl-loop.template.sh
- GLOSSARY.md Format
- implement-spec/SKILL.md
- CREDITS.md
- dependencies.md

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 97 edges
2. `createBackend()` - 83 edges
3. `Button()` - 66 edges
4. `scripts` - 64 edges
5. `WorkId` - 50 edges
6. `Tx` - 46 edges
7. `@tanstack/react-query` - 38 edges
8. `callApi()` - 38 edges
9. `createLogger()` - 36 edges
10. `WorksModule` - 35 edges

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

## Communities (220 total, 32 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "run-local.test.mjs"
Cohesion: 0.16
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "work-screen.tsx"
Cohesion: 0.10
Nodes (22): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), WorkScreen(), FactsEditor() (+14 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "src/works/index.ts"
Cohesion: 0.08
Nodes (50): allKeys(), FactValues, sameFieldValue(), sameFieldValues(), sameRow(), mentions(), previewEntries(), FactConflict (+42 more)

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

### Community 20 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "modules/works/index.ts"
Cohesion: 0.14
Nodes (33): DocumentsModule, availablePackages(), WorkError, WorkSources, FileId, requireAnalysisInputs(), requireIdleWork(), requireRemovalSource() (+25 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "work-list.tsx"
Cohesion: 0.16
Nodes (19): WorkListPage(), useCreateWork(), useDeleteWork(), documentPackagesQueryOptions(), workDeletionQueryOptions(), worksQueryOptions(), readWorkListParams(), workListHref() (+11 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Process"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.13
Nodes (23): memoryIdempotency(), Row, AcquireInput, AcquireOutcome, IdempotencyKeyRef, IdempotencyStore, StoredResponse, IdempotencyDeps (+15 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "app-shell.tsx"
Cohesion: 0.11
Nodes (26): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), ShellFrame() (+18 more)

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

### Community 37 - "transactions/index.ts"
Cohesion: 0.19
Nodes (28): AgentsModule, ConnectionsModule, ResourceLocks, FactsModule, GenerationModule, ProcessingModule, ProcessingPorts, ProcessingQueries (+20 more)

### Community 38 - "ids.ts"
Cohesion: 0.09
Nodes (20): works, Проектирование адресов, attachDocument(), createWork(), findWork(), listEvents(), listWorks(), readCursor() (+12 more)

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
Cohesion: 0.08
Nodes (24): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, @anyko/database, @anyko/llm, @anyko/logger (+16 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "client.ts"
Cohesion: 0.14
Nodes (16): Интерфейс, dynamic, relay(), HttpFetch, request(), requestApi(), requestApiFile(), RequestOptions (+8 more)

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

### Community 52 - "access/index.ts"
Cohesion: 0.14
Nodes (20): authRoutes(), access, member, Область и права, ownerOnlyRights, rightsForRole(), AccessSession, issueScope() (+12 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "audit/index.ts"
Cohesion: 0.12
Nodes (25): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+17 more)

### Community 55 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.10
Nodes (31): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+23 more)

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
Cohesion: 0.22
Nodes (4): graphify, Один модульный монолит с отдельными процессами, Ключ v2, Пробный прогон v1 — 5 ноября 2026

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

### Community 64 - "tempfile"
Cohesion: 0.25
Nodes (3): model_path(), valid_model(), install()

### Community 65 - "mastra.ts"
Cohesion: 0.12
Nodes (17): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), healthResponseSchema (+9 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "document-workspace.tsx"
Cohesion: 0.12
Nodes (26): RecognitionPage(), documentsQueryOptions(), describeDocumentError(), documentTexts, recognitionFailureText(), recognitionRetryCode, recognitionRetryText, recognitionPollInterval() (+18 more)

### Community 73 - "works/endpoints.ts"
Cohesion: 0.04
Nodes (49): Sent, session, fieldKeySchema, fieldValueSchema, fieldValuesSchema, cursorResponseSchema(), deletingStatusSchema, documentDeletionSchema (+41 more)

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
Cohesion: 0.16
Nodes (18): confirmValues(), editValues(), readFacts(), comparableFactValue(), confirmFacts(), editFacts(), emptyFacts(), FactsPorts (+10 more)

### Community 78 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "document-deletion.test.ts"
Cohesion: 0.06
Nodes (27): DocumentParser, SourceStorage, createDeletionStore(), createProcessingIo(), StorageWriteOutcomeUnknown, createDocumentDeletionWorkflow(), createDocumentOcrWorkflow(), failureCodes (+19 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "processing/index.ts"
Cohesion: 0.07
Nodes (19): Как проверяются правила, isActive(), listRuns(), startRun(), AttemptWrite, claimWorkAttempt(), WorkAttempt, StepOutput (+11 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.11
Nodes (24): createApp(), ConnectionHttpOptions, WorkHttpOptions, Analyze, appWith(), logger, memberAccess, memberSession (+16 more)

### Community 88 - "connection-settings.tsx"
Cohesion: 0.07
Nodes (47): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), useRevokeLlmSettings() (+39 more)

### Community 89 - "modules/documents/index.ts"
Cohesion: 0.08
Nodes (16): box, coordinate, documentResultSchema, DocumentErrors, DocumentDeletionStatus, DocumentImage, DocumentResultView, DocumentSourceFile (+8 more)

### Community 90 - "teach/SKILL.md"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "documents/application/ports.ts"
Cohesion: 0.21
Nodes (9): Artifact, ArtifactRegistry, DocumentListInput, DocumentPage, DocumentPosition, DocumentResult, DocumentStatus, pdfOcrSchema (+1 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.29
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.08
Nodes (12): descendant_handles(), initdb_diagnostic(), ModelHandler, request(), start(), main(), port(), ready() (+4 more)

### Community 95 - "Codebase Design"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "mutations.test.tsx"
Cohesion: 0.16
Nodes (17): renderWork(), source, result, serveWork(), serveWork(), FakeEventSource, installEventSource(), json() (+9 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.12
Nodes (19): Контрольные примеры для reviewer, AgentSessionStore, combineCandidates(), Reconciliation, reconciliationSchema, selectSessionCandidates(), AgentDocument, AgentsPorts (+11 more)

### Community 99 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (17): This is NOT the Next.js you know, Архитектура, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система (+9 more)

### Community 100 - "work-pipeline.tsx"
Cohesion: 0.11
Nodes (27): analysisRuns(), groupSteps(), Run, runProgress(), Step, Run, Step, visionVisuals() (+19 more)

### Community 101 - "http/route.ts"
Cohesion: 0.09
Nodes (30): BodyOf, checkedJson(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart, parseWith() (+22 more)

### Community 102 - "works/api/mutations.ts"
Cohesion: 0.15
Nodes (26): useGenerateWork(), CreateWorkInput, FactsDraft, invalidateWork(), renderCommands(), wrapperFor(), useAnalyzeWork(), useConfirmWork() (+18 more)

### Community 103 - "create-backend.ts"
Cohesion: 0.07
Nodes (43): Последствия, AccessOptions, agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), createArtifactRegistry(), createSourceCleanup() (+35 more)

### Community 104 - "ui/src/index.ts"
Cohesion: 0.07
Nodes (47): Files(), Generation, generationTones, WorkResults(), Document, labels, WorkSources(), WorkCard() (+39 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "ref_bun_test"
Cohesion: 0.13
Nodes (14): pack, paragraph(), fieldDefinitions, createdWorkView, existingWork, json(), packages, serveWorkList() (+6 more)

### Community 107 - "call.ts"
Cohesion: 0.15
Nodes (21): BodyField, CallArgs, callFileApi(), CallOptions, encodeBody(), endpointUrl(), FileEndpoint, fillPath() (+13 more)

### Community 108 - "start.ts"
Cohesion: 0.08
Nodes (23): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, config, db, pool, redis (+15 more)

### Community 109 - "app.ts"
Cohesion: 0.11
Nodes (32): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+24 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "bfl/fields.ts"
Cohesion: 0.15
Nodes (18): factsSchema, templateData(), candidateSchema, collectionLabels, emptyFieldValues(), fieldKeySchema, FieldRow, fieldRowSchema (+10 more)

### Community 112 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 113 - "Решение"
Cohesion: 0.11
Nodes (20): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Решение (+12 more)

### Community 114 - "facts-form.test.tsx"
Cohesion: 0.13
Nodes (12): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+4 more)

### Community 115 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 116 - "Logger"
Cohesion: 0.22
Nodes (6): ApiInput, AppOptions, DocumentHttpOptions, SystemJobContext, BackendOptions, Logger

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "ProcessingIo"
Cohesion: 0.13
Nodes (12): Единый механизм запусков, Единые таблицы запусков, Восстановление и данные, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Начальная топология, Порядок выпуска, Процесс и наблюдаемость (+4 more)

### Community 119 - "Примеры v2"
Cohesion: 0.22
Nodes (9): C1, C2, C3, C4, C5, C6, C7, C8 (+1 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "During the session"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "session-gate.ts"
Cohesion: 0.26
Nodes (9): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+1 more)

### Community 124 - "transactionHandle"
Cohesion: 0.09
Nodes (29): createAuditModule(), Connection, connectionsStoreFor(), createConnectionsStore(), lockLiveDocumentForResponse(), createIdempotencyStore(), idempotencyStoreFor(), redactResourceResponses() (+21 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "HTML Report Format"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "endpoint.ts"
Cohesion: 0.06
Nodes (39): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+31 more)

### Community 128 - "templates/index.ts"
Cohesion: 0.13
Nodes (18): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), block, cell, document (+10 more)

### Community 129 - "server/config.ts"
Cohesion: 0.40
Nodes (3): register(), schema, server-only

### Community 130 - "api/errors.ts"
Cohesion: 0.11
Nodes (19): revokeConnection(), conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), connectionRevokedText, workCommandReasons, workCommandTexts (+11 more)

### Community 131 - "template.sh"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.05
Nodes (44): brandWorkId(), changeDeps, config, db, failing, failureOf(), lockPool, logger (+36 more)

### Community 133 - ""AnykoWorkspace""
Cohesion: 0.18
Nodes (14): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+6 more)

### Community 134 - "Ask Matt"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "upload.ts"
Cohesion: 0.19
Nodes (14): formats, imageContainerFormat(), isDocx(), matchesSourceFormat(), sourceContentTypes, SourceFormat, sourceFormatFromKey(), startsWith() (+6 more)

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
Cohesion: 0.11
Nodes (29): DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer(), Mode (+21 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "automatic-value.ts"
Cohesion: 0.23
Nodes (15): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), automaticValue(), Candidate, checksum(), date() (+7 more)

### Community 143 - "Test-Driven Development"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "connections/endpoints.ts"
Cohesion: 0.10
Nodes (17): connectionKeys, LlmSettingsInput, ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, getLlmSettings, revokeLlmSettings (+9 more)

### Community 145 - "DocumentId"
Cohesion: 0.22
Nodes (5): DocumentView, DocumentsCommands, DocumentsInternal, DocumentsQueries, DocumentId

### Community 146 - "documents/application/ports.ts"
Cohesion: 0.18
Nodes (19): deleteDocument(), documents, listDocuments(), readPosition(), listPendingDeletions(), DocumentDeps, readAnalysis(), readArtifact() (+11 more)

### Community 147 - "Process"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "eslint.config.mjs"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "continue-session.ts"
Cohesion: 0.24
Nodes (13): DocumentAnalysis, ContinuationSource, createWorkContinuation(), createWorkAnalysis(), delay(), compact(), locateEvidence(), addUsage() (+5 more)

### Community 150 - "writing-for-agents/SKILL.md"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "modules/connections/index.ts"
Cohesion: 0.17
Nodes (11): AuditModule, input, currentConnection(), LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection() (+3 more)

### Community 152 - "callApi"
Cohesion: 0.27
Nodes (12): RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion() (+4 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.06
Nodes (30): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), createS3Storage(), BackendConfig, BackendConfigError (+22 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "routes/works/index.ts"
Cohesion: 0.17
Nodes (22): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), documentSummary(), workEventStream(), presentWork(), worksRoutes() (+14 more)

### Community 158 - "EventHorizon"
Cohesion: 0.23
Nodes (9): DocxOriginal(), fitPages(), CosmicBackground(), EventHorizon(), paint(), schedule(), tick(), HorizonState (+1 more)

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "work-list.test.tsx"
Cohesion: 0.18
Nodes (12): manrope, metadata, onest, RootLayout(), Providers(), renderWorkspace(), Status, renderWorkList() (+4 more)

### Community 161 - "wayfinder/SKILL.md"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - "ref_node_fs"
Cohesion: 0.12
Nodes (9): { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, components, env, root (+1 more)

### Community 163 - "@tanstack/react-query"
Cohesion: 0.21
Nodes (13): WorkspaceLayout(), AppShell(), renderShell(), user, RenderBoundary, session, session, sessionKeys (+5 more)

### Community 164 - "documents/application/commands.test.ts"
Cohesion: 0.12
Nodes (3): DocumentStore, Connection, Registration

### Community 165 - "support/endpoints.ts"
Cohesion: 0.26
Nodes (10): RouteEnv, contractModules, describedEndpoints(), NamedEndpoint, namedEndpoints(), endpoint, isEndpoint(), apiCatalogIsCurrent() (+2 more)

### Community 166 - "to-spec/SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.14
Nodes (13): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+5 more)

### Community 168 - "fingerprintInput"
Cohesion: 0.60
Nodes (3): canonicalize(), fingerprintInput(), ADR-0009

### Community 169 - "Triage"
Cohesion: 0.07
Nodes (25): Bad agent brief, Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Examples, Explicit scope boundaries, Good agent brief (bug), Good agent brief (enhancement) (+17 more)

### Community 170 - ""WorkGeneration""
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "architecture.md"
Cohesion: 0.14
Nodes (10): Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере (+2 more)

### Community 173 - "ref_node_path"
Cohesion: 0.12
Nodes (7): config, env, lock, root, links, marker, [target, link]

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 176 - "use-work-view.ts"
Cohesion: 0.24
Nodes (9): useWorkEvents(), WorkLive, documentPackageKeys, workKeys, workQueryOptions(), loadErrorText(), useWorkView(), getWork (+1 more)

### Community 177 - "job-host.test.ts"
Cohesion: 0.08
Nodes (21): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime(), envelope (+13 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 181 - "Process"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "<Questionnaire title>"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 184 - "connection-settings.test.tsx"
Cohesion: 0.31
Nodes (7): configured, json(), renderSettings(), serveSaveAnswer(), serveSettings(), sessionWith(), Settings

### Community 185 - "Process"
Cohesion: 0.33
Nodes (5): 1. Scope the procedure, 2. Map each stage's journey, 4. Verify and hand off, Process, Wizard

### Community 186 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 187 - "src/session/index.ts"
Cohesion: 0.10
Nodes (14): Call, session, sessionCookieNames, getSession, Right, rights, rightSchema, ADR-0009 (+6 more)

### Community 188 - "Web-приложение"
Cohesion: 0.29
Nodes (7): Feature, UI, Web-приложение, Перед отчётом, Структура, Тестирование, Уровни и импорты

### Community 189 - "bootstrap.mjs"
Cohesion: 0.29
Nodes (6): child, metadata, mineru, path, python, root

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Каталог HTTP API"
Cohesion: 0.50
Nodes (4): catalog, connections, session, Каталог HTTP API

### Community 193 - "Sections"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 194 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 195 - "[file]/route.ts"
Cohesion: 0.33
Nodes (4): assetTypes, GET(), LlmSettings, Подключение модели

### Community 196 - "documents/application/commands.test.ts"
Cohesion: 0.40
Nodes (4): failed, queued, store(), unused()

### Community 197 - ""DocumentIo""
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 200 - "jobs/index.ts"
Cohesion: 0.07
Nodes (40): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Фоновые задания, Задания, idempotencyCleanupJob(), createIdempotencyMaintenance() (+32 more)

### Community 201 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 202 - "WorkspaceScope"
Cohesion: 0.07
Nodes (31): connections, 3. Author the wizard, Доверенный scope и права, FactsCommands, createGeneration(), listGenerations(), readGeneration(), GenerationCommands (+23 more)

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1777 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `MinerU и RouterAI: граница совместимости`, `LogReaderTests`, `access/index.ts`, `http/route.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `src/session/index.ts` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._