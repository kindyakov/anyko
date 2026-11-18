# Graph Report - integration-31-41  (2026-11-18)

## Corpus Check
- 727 files · ~315,182 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 7, .ttf 5, .example 4)

## Summary
- 4179 nodes · 10347 edges · 231 communities (195 shown, 36 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 249 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fef1769b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- run-local.test.mjs
- ui/src/index.ts
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- Button
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
- 202611050001_document_vertical/migration.sql
- ids.ts
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- callApi
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- database/src/index.ts
- infrastructure/auth.ts
- llm/package.json
- integration/idempotency.test.ts
- works/endpoints.ts
- Issue tracker: GitHub
- Первая вертикаль обработки документов
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
- unit-of-work.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- WorkspaceScope
- agent-github.mjs
- ref_bun_test
- boundaries.test.ts
- ProcessingIo
- stage-windows-migrator.mjs
- work-store.ts
- dev.mjs
- devDependencies
- logger/src/index.ts
- routes/works/index.ts
- work-pipeline.md
- teach/SKILL.md
- LogReaderTests
- Database
- Runtime и диагностика
- smoke-windows-release.py
- Codebase Design
- stage-windows-mineru.mjs
- ref_bun_test
- Tx
- Anyko — брендбук
- 202611050007_work_pipeline/migration.sql
- http/route.ts
- smoke-windows-mineru.mjs
- facts-form.ts
- documents/schemas.ts
- exports
- work-pipeline.tsx
- job-host.test.ts
- start.ts
- app.ts
- llm/tsconfig.json
- bfl/fields.ts
- dependencies.md
- Решение
- documents/module.ts
- DocumentStore
- transactions/index.ts
- workspace-states.tsx
- 202611170017_unified_processing/migration.sql
- Примеры v2
- Agent skills
- During the session
- session/schemas.ts
- build-windows-web.mjs
- create-backend.ts
- deep-sky.ts
- HTML Report Format
- endpoint.ts
- templates/index.ts
- call.ts
- create-work-form.tsx
- template.sh
- works.test.ts
- audit.test.ts
- Ask Matt
- unit-of-work.test.ts
- Diagnosing Bugs
- ui/package.json
- Язык Anyko
- document-viewer.tsx
- result-preview.tsx
- mineru.ts
- Данные, доступ и фоновые задания
- Test-Driven Development
- access.test.ts
- check-project.mjs
- connection-settings.tsx
- Process
- eslint.config.mjs
- work-analysis/index.ts
- writing-for-agents/SKILL.md
- audit/index.ts
- unit-of-work.test.ts
- runtime/index.ts
- setup.ts
- Решение
- automatic-value.ts
- documents/application/ports.ts
- pdf_ocr.py
- server/config.ts
- wayfinder/SKILL.md
- "AnykoWorkspace"
- audit/module.ts
- call.test.ts
- FakeEventSource
- to-spec/SKILL.md
- black-hole-renderer.ts
- document-ocr/index.ts
- Triage
- pagination.ts
- Направления развития Anyko
- support/endpoints.ts
- ref_node_fs
- e2e/tsconfig.json
- DeliveryPort
- ref_zod
- diagnostic-worker.test.ts
- ui/tsconfig.json
- Logger
- PdfRecoveryReview
- Process
- <Questionnaire title>
- "WorkGeneration"
- Размещение основы в Dokploy
- Process
- app/layout.tsx
- EventHorizon
- 202611060012_work_agent_sessions/migration.sql
- sha256Hex
- stage-windows-web.mjs
- Серверная часть
- ref_node_path
- Sections
- sign-in.tsx
- job-scope.ts
- smoke-windows-components.mjs
- journeys.spec.ts
- ProcessorReview
- test_processor.py
- jobs/index.ts
- DocumentDeps
- WorkspaceScope
- hitl-loop.template.sh
- GLOSSARY.md Format
- implement-spec/SKILL.md
- CREDITS.md
- devDependencies
- agent-session.ts
- "IdempotencyKey"
- Feature-based web и модульный backend с ports/adapters
- 202611180018_work_deletion_and_listing/migration.sql
- server/session.test.ts
- Работа агентов и независимая проверка
- Каталог HTTP API
- "DocumentIo"
- Anyko
- scripts
- render.ts

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 100 edges
2. `createBackend()` - 83 edges
3. `Button()` - 66 edges
4. `scripts` - 64 edges
5. `WorkId` - 53 edges
6. `Tx` - 49 edges
7. `@tanstack/react-query` - 38 edges
8. `callApi()` - 38 edges
9. `createLogger()` - 36 edges
10. `WorksModule` - 35 edges

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

## Communities (231 total, 36 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.09
Nodes (22): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+14 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "run-local.test.mjs"
Cohesion: 0.16
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "ui/src/index.ts"
Cohesion: 0.11
Nodes (20): UnsavedNavigation(), Size, sizes, Variant, variants, Confirm(), fieldSurface, Skeleton() (+12 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Button"
Cohesion: 0.09
Nodes (44): mentions(), previewEntries(), candidateSelection(), filled(), ReviewField, reviewFields(), ReviewFilter, FactsForm (+36 more)

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

### Community 20 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "modules/works/index.ts"
Cohesion: 0.14
Nodes (31): WorkDeletion, WorkError, WorkEventKind, WorkListPage, WorkSourceRow, WorkSources, WorksPorts, WorkSummary (+23 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "work-list.tsx"
Cohesion: 0.12
Nodes (28): WorkListPage(), useCreateWork(), useDeleteWork(), documentPackagesQueryOptions(), workDeletionQueryOptions(), worksQueryOptions(), readWorkListParams(), workListHref() (+20 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Process"
Cohesion: 0.07
Nodes (29): recognitionPollInterval(), recognitionPollMs, RecognitionSnapshot, document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over (+21 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.12
Nodes (25): KeyedResponse, Row, AcquireInput, AcquireOutcome, CommandResponse, CreatedResource, IdempotencyKeyRef, IdempotencyStore (+17 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "app-shell.tsx"
Cohesion: 0.08
Nodes (37): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), WorkspaceLayout() (+29 more)

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

### Community 37 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.10
Nodes (31): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+23 more)

### Community 38 - "ids.ts"
Cohesion: 0.07
Nodes (17): works, attachDocument(), createWork(), failureOf(), findWork(), hasActiveDocument(), listEvents(), listWorks() (+9 more)

### Community 40 - "smoke-windows-migrator.mjs"
Cohesion: 0.14
Nodes (10): appdata, bin, data, env, identity, infra, migrator, migratorSource (+2 more)

### Community 41 - "processor.py"
Cohesion: 0.09
Nodes (15): image_png(), media_entries(), prepare_docx(), replace_missing_visuals(), read_image_lines(), erase(), health(), parse() (+7 more)

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

### Community 47 - "callApi"
Cohesion: 0.12
Nodes (35): RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion() (+27 more)

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
Cohesion: 0.11
Nodes (19): BackendDependencies, countingSeams(), createDatabase(), createDatabasePool(), createLockPool(), DatabasePool, createResourceLocks(), db (+11 more)

### Community 52 - "infrastructure/auth.ts"
Cohesion: 0.17
Nodes (15): connections, access, member, memberSession, ownerOnlyRights, rightsForRole(), AccessSession, issueScope() (+7 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "integration/idempotency.test.ts"
Cohesion: 0.13
Nodes (11): createIdempotencyMaintenanceStore(), createIdempotencyMaintenance(), IdempotencyMaintenanceStore, api, clock, current, db, logger (+3 more)

### Community 55 - "works/endpoints.ts"
Cohesion: 0.08
Nodes (30): fieldValueSchema, fieldValuesSchema, downloadGeneratedFile, getWorkDocumentResult, uuid, workDocumentParams, workParams, candidateSchema (+22 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.11
Nodes (17): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "engineering/README.md"
Cohesion: 0.22
Nodes (4): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу

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
Cohesion: 0.16
Nodes (6): model_path(), valid_model(), install(), main(), port(), ready()

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
Cohesion: 0.09
Nodes (40): documentSummary(), RecognitionPage(), documentsQueryOptions(), describeDocumentError(), documentTexts, recognitionFailureText(), recognitionRetryCode, recognitionRetryText (+32 more)

### Community 73 - "unit-of-work.ts"
Cohesion: 0.16
Nodes (17): Connection, createDocumentCommands(), Registration, createDocumentReadModel(), legacyPdf(), view(), statusSchema, nextRunRevision() (+9 more)

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
Cohesion: 0.14
Nodes (20): acceptRunCandidates(), Candidate, ref, runFacts(), confirmValues(), editValues(), readAnalysisFacts(), readFacts() (+12 more)

### Community 78 - "WorkspaceScope"
Cohesion: 0.09
Nodes (23): Доверенный scope и права, DocumentsCommands, DocumentsQueries, ProcessingQueries, availablePackages(), WorksCommands, WorksQueries, Brand (+15 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "ref_bun_test"
Cohesion: 0.09
Nodes (28): describeWorkCommandError(), workCommandReasons, workCommandTexts, uploadFailureMessage(), uploadTexts, HttpFetch, request(), requestApi() (+20 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "ProcessingIo"
Cohesion: 0.09
Nodes (16): RenderBoundary, Фоновые задания, Единый механизм запусков, Задания, Восстановление и данные, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Начальная топология (+8 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "work-store.ts"
Cohesion: 0.06
Nodes (31): Единые таблицы запусков, DocumentAttempt, isActive(), listRuns(), DocumentAttemptStore, DocumentRunOutcome, DocumentRunSnapshot, claimRunAttempt() (+23 more)

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.10
Nodes (22): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), createApp(), Analyze, appWith() (+14 more)

### Community 88 - "routes/works/index.ts"
Cohesion: 0.14
Nodes (26): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), presentDocumentResult(), workEventStream(), presentWork(), worksRoutes() (+18 more)

### Community 89 - "work-pipeline.md"
Cohesion: 0.15
Nodes (9): Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Агентский контекст и данные, Локальный запуск и доказательства, Повторы визуального анализа, Полное удаление и восстановление, Постоянный контекст работы (+1 more)

### Community 90 - "teach/SKILL.md"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "Database"
Cohesion: 0.23
Nodes (13): lockLiveDocumentForResponse(), createIdempotencyStore(), idempotencyStoreFor(), redactResourceResponses(), workSummarySchema, createWorkDeletionStore(), lockLiveWorkForResponse(), Connection (+5 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.13
Nodes (8): descendant_handles(), initdb_diagnostic(), ModelHandler, start(), child(), dead(), main(), supervisor()

### Community 95 - "Codebase Design"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "ref_bun_test"
Cohesion: 0.06
Nodes (60): renderShell(), user, session, renderWork(), source, configured, json(), renderSettings() (+52 more)

### Community 98 - "Tx"
Cohesion: 0.13
Nodes (10): Reconciliation, reconciliationSchema, DocumentAgents, Connection, AgentSession, AgentSessionContext, agentSessionContextSchema, agentSessionSchema (+2 more)

### Community 99 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (18): This is NOT the Next.js you know, Архитектура, Интерфейс, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот (+10 more)

### Community 100 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 101 - "http/route.ts"
Cohesion: 0.09
Nodes (32): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+24 more)

### Community 102 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 103 - "facts-form.ts"
Cohesion: 0.11
Nodes (31): applyRevision(), draftForSave(), FactsDraft, FactsDraftEvent, FactsDraftTransition, FactsFormChange, FactsRevision, hasFactsDraftEdits() (+23 more)

### Community 104 - "documents/schemas.ts"
Cohesion: 0.18
Nodes (7): cursorResponseSchema(), deletingStatusSchema, documentDeletionSchema, documentResponseSchema, documentSchema, uploadFileSchema, config

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "work-pipeline.tsx"
Cohesion: 0.07
Nodes (45): Hero(), Stepper(), Document, LiveState, WorkBody(), analysisRuns(), groupSteps(), Run (+37 more)

### Community 107 - "job-host.test.ts"
Cohesion: 0.09
Nodes (33): claimDocumentAttempt(), documentOcrPolicy, activeAttempt(), claimRun(), finishRun(), NotifyDocumentRun, recoverRuns(), RecoveryPolicy (+25 more)

### Community 108 - "start.ts"
Cohesion: 0.10
Nodes (19): DocumentParser, E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, agents, api, config (+11 more)

### Community 109 - "app.ts"
Cohesion: 0.11
Nodes (30): registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore(), originGuard(), safeMethods (+22 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "bfl/fields.ts"
Cohesion: 0.17
Nodes (16): factsSchema, templateData(), candidateSchema, collectionLabels, emptyFieldValues(), fieldDefinitions, fieldKeySchema, fieldRowSchema (+8 more)

### Community 113 - "Решение"
Cohesion: 0.16
Nodes (13): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Последствия (+5 more)

### Community 114 - "documents/module.ts"
Cohesion: 0.19
Nodes (17): failed, queued, store(), unused(), listPendingDeletions(), DocumentView, readDeletion(), readDocument() (+9 more)

### Community 116 - "transactions/index.ts"
Cohesion: 0.14
Nodes (34): AgentSessionStore, AgentDocument, AgentsModule, AgentsPorts, AgentUsage, AgentsDeps, ConnectionsModule, ResourceLocks (+26 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "202611170017_unified_processing/migration.sql"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 119 - "Примеры v2"
Cohesion: 0.15
Nodes (12): C1, C2, C3, C4, C5, C6, C7, C8 (+4 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "During the session"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "session/schemas.ts"
Cohesion: 0.24
Nodes (7): getSession, rights, rightSchema, ADR-0009, Membership, membershipSchema, sessionResponseSchema

### Community 124 - "create-backend.ts"
Cohesion: 0.08
Nodes (33): agentSessionStoreFor(), createAgentSessionStore(), createAgentsModule(), record(), createAuditModule(), Connection, connectionsStoreFor(), createConnectionsStore() (+25 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "HTML Report Format"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "endpoint.ts"
Cohesion: 0.07
Nodes (33): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+25 more)

### Community 128 - "templates/index.ts"
Cohesion: 0.13
Nodes (17): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), block, cell, document (+9 more)

### Community 129 - "call.ts"
Cohesion: 0.10
Nodes (29): BodyField, CallArgs, callFileApi(), CallOptions, encodeBody(), endpointUrl(), FileEndpoint, fillPath() (+21 more)

### Community 130 - "create-work-form.tsx"
Cohesion: 0.11
Nodes (24): CreateWorkForm(), createWorkTexts, packageSchema, titleSchema, Формы, fieldContext, formContext, useFieldContext (+16 more)

### Community 131 - "template.sh"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.07
Nodes (23): actualPool, agents, apiBackend, availabilityCases, Command, commands, create(), db (+15 more)

### Community 133 - "audit.test.ts"
Cohesion: 0.10
Nodes (17): Повтор команд и журнал действий, AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), connectionApi(), db, encryptionKey (+9 more)

### Community 134 - "Ask Matt"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "unit-of-work.test.ts"
Cohesion: 0.07
Nodes (23): createQueueProbe(), SourceStorage, createSourceCleanup(), fixture(), workspaceWithWork(), memberScope(), startDocumentWorker(), api (+15 more)

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
Nodes (28): documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer(), Mode, PaperSkeleton() (+20 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 141 - "mineru.ts"
Cohesion: 0.16
Nodes (16): formats, imageContainerFormat(), isDocx(), matchesSourceFormat(), sourceContentTypes, SourceFormat, sourceFormatFromKey(), startsWith() (+8 more)

### Community 142 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 143 - "Test-Driven Development"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "access.test.ts"
Cohesion: 0.10
Nodes (16): ConnectionHttpOptions, ConnectionSettingsApi, ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, revokeLlmSettings, saveLlmSettings (+8 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 146 - "connection-settings.tsx"
Cohesion: 0.17
Nodes (15): ConnectionsPage(), connectionKeys, LlmSettingsInput, useRevokeLlmSettings(), useSaveLlmSettings(), llmSettingsQueryOptions(), addressSchema, ConnectionForm() (+7 more)

### Community 147 - "Process"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "eslint.config.mjs"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "work-analysis/index.ts"
Cohesion: 0.11
Nodes (22): DocumentAnalysis, DocumentDeletionStatus, DocumentImage, InternalDocumentRef, PendingDocumentDeletion, ADR-0009, generateDocument(), WorkAttempt (+14 more)

### Community 150 - "writing-for-agents/SKILL.md"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "audit/index.ts"
Cohesion: 0.16
Nodes (12): AuditModule, input, currentConnection(), LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection() (+4 more)

### Community 152 - "unit-of-work.test.ts"
Cohesion: 0.13
Nodes (16): emptyFacts(), createFactsStore(), factsStoreFor(), changeDeps, config, db, failing, failureOf() (+8 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.09
Nodes (22): createS3Storage(), BackendConfig, BackendConfigError, BackendConfigErrorCode, backendConfigSchema, encryptionKey, httpUrl, postgresUrl (+14 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.14
Nodes (27): comparableFactValue(), confirmFacts(), editFacts(), findFactDiscrepancies(), includesFactValue(), markSelectedCandidates(), mergeCandidates(), reconcile() (+19 more)

### Community 158 - "documents/application/ports.ts"
Cohesion: 0.20
Nodes (11): deleteDocument(), documents, listDocuments(), readPosition(), Artifact, DocumentListInput, DocumentPage, DocumentPosition (+3 more)

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "server/config.ts"
Cohesion: 0.19
Nodes (8): dynamic, relay(), register(), proxyApiRequest(), readServerConfig(), schema, HttpMethod, server-only

### Community 161 - "wayfinder/SKILL.md"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - ""AnykoWorkspace""
Cohesion: 0.23
Nodes (12): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+4 more)

### Community 163 - "audit/module.ts"
Cohesion: 0.23
Nodes (9): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+1 more)

### Community 164 - "call.test.ts"
Cohesion: 0.10
Nodes (18): WorkPage(), WorkScreen(), useWorkEvents(), WorkLive, documentPackageKeys, workKeys, workQueryOptions(), loadErrorText() (+10 more)

### Community 166 - "to-spec/SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.13
Nodes (14): DiskProjection, HoleFrame, paintBlackHole(), annulus(), disk(), drawSpacecraft(), project(), startBlackHole() (+6 more)

### Community 168 - "document-ocr/index.ts"
Cohesion: 0.21
Nodes (7): ArtifactRegistry, box, coordinate, documentResultSchema, pdf, documentImageLimit, failureCodes

### Community 169 - "Triage"
Cohesion: 0.07
Nodes (25): Bad agent brief, Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Examples, Explicit scope boundaries, Good agent brief (bug), Good agent brief (enhancement) (+17 more)

### Community 170 - "pagination.ts"
Cohesion: 0.18
Nodes (9): cursor, cursorQuerySchema, ListMode, listQueries, listResponses, page, pageQuery(), pageResponseSchema() (+1 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "support/endpoints.ts"
Cohesion: 0.26
Nodes (10): RouteEnv, contractModules, describedEndpoints(), NamedEndpoint, namedEndpoints(), endpoint, isEndpoint(), apiCatalogIsCurrent() (+2 more)

### Community 173 - "ref_node_fs"
Cohesion: 0.11
Nodes (10): assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, env, lock (+2 more)

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 176 - "ref_zod"
Cohesion: 0.26
Nodes (11): documentLockKey(), idempotencyCleanupJob(), DocumentArtifacts, defineJob(), RunPolicy, createJobRegistry(), documentMaintenanceJob(), documentOcrJob() (+3 more)

### Community 177 - "diagnostic-worker.test.ts"
Cohesion: 0.12
Nodes (16): parseBackendEnv(), schema, parseWorkerConfig(), schema, startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime() (+8 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "Logger"
Cohesion: 0.24
Nodes (6): ApiInput, AppOptions, DocumentHttpOptions, WorkHttpOptions, BackendOptions, Logger

### Community 181 - "Process"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "<Questionnaire title>"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - ""WorkGeneration""
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 184 - "Размещение основы в Dokploy"
Cohesion: 0.33
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 185 - "Process"
Cohesion: 0.33
Nodes (5): 1. Scope the procedure, 2. Map each stage's journey, 4. Verify and hand off, Process, Wizard

### Community 186 - "app/layout.tsx"
Cohesion: 0.29
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 187 - "EventHorizon"
Cohesion: 0.16
Nodes (15): WorkNotFound(), Files(), Generation, generationTones, WorkResults(), DropZone(), filePlural, Flying (+7 more)

### Community 188 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 189 - "sha256Hex"
Cohesion: 0.33
Nodes (6): readAnalysis(), canonicalize(), fingerprintInput(), ADR-0009, sha256Hex(), ADR-0009

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Серверная часть"
Cohesion: 0.22
Nodes (9): GET(), LlmSettings, Модуль, Ошибки, Подключение модели, Серверная часть, Структура, Тесты (+1 more)

### Community 192 - "ref_node_path"
Cohesion: 0.12
Nodes (10): config, child, metadata, mineru, path, python, root, links (+2 more)

### Community 193 - "Sections"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 194 - "sign-in.tsx"
Cohesion: 0.43
Nodes (6): clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe()

### Community 195 - "job-scope.ts"
Cohesion: 0.16
Nodes (12): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, JobRegistry, ExecutionScope, issueExecutionScope() (+4 more)

### Community 196 - "smoke-windows-components.mjs"
Cohesion: 0.29
Nodes (3): components, env, root

### Community 197 - "journeys.spec.ts"
Cohesion: 0.33
Nodes (4): @playwright/test, ObservedEventSource, required(), signIn()

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 200 - "jobs/index.ts"
Cohesion: 0.11
Nodes (16): dispatchOutbox(), reconcileJobs(), CommonDefinition, currentEnvelope, identity, JobDelivery, JobRuntime, RetryPolicy (+8 more)

### Community 201 - "DocumentDeps"
Cohesion: 0.53
Nodes (4): DocumentDeps, readArtifact(), readResult(), DocumentResultView

### Community 202 - "WorkspaceScope"
Cohesion: 0.08
Nodes (19): 3. Author the wizard, Проектирование адресов, HTTP, SSE и настройки, FactsCommands, createGeneration(), listGenerations(), readGeneration(), GenerationCommands (+11 more)

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 214 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 215 - "agent-session.ts"
Cohesion: 0.33
Nodes (5): fieldKeySchema, AgentSession, AgentSessionContext, agentSessionContextSchema, agentSessionSchema

### Community 216 - ""IdempotencyKey""
Cohesion: 0.50
Nodes (3): "IdempotencyKey", IdempotencyKey_expiresAt_idx, IdempotencyKey_resource_idx

### Community 217 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 218 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 220 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 221 - "Каталог HTTP API"
Cohesion: 0.50
Nodes (4): catalog, connections, session, Каталог HTTP API

### Community 222 - ""DocumentIo""
Cohesion: 0.83
Nodes (3): "DocumentIo", DocumentIo_workspaceId_documentId_idx, DocumentIo_workspaceId_requestKey_idx

### Community 223 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1782 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `routes/works/index.ts`, `Первая вертикаль обработки документов`, `LogReaderTests`, `Серверная часть`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `journeys.spec.ts` to `package.json`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._