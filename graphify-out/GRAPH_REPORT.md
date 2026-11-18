# Graph Report - anyko  (2026-11-18)

## Corpus Check
- 741 files · ~325,983 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 6, .ttf 5, .example 4)

## Summary
- 4227 nodes · 10673 edges · 229 communities (192 shown, 37 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 248 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `52555cdf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- ref_bun_test
- documents/module.ts
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- ref_react
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
- mineru.ts
- exports
- web/tsconfig.json
- ui/src/index.ts
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
- WorkspaceScope
- library.json
- smoke-windows-migrator.mjs
- processor.py
- dependencies
- architecture/tsconfig.json
- backend/package.json
- backend/tsconfig.json
- logger/tsconfig.json
- facts-form.test.tsx
- database/package.json
- stage-windows-release.mjs
- contracts/package.json
- database/src/index.ts
- ids.ts
- llm/package.json
- create-backend.ts
- endpoint.ts
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
- document-workspace.tsx
- mineru.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- modules/documents/index.ts
- agent-github.mjs
- api/errors.ts
- boundaries.test.ts
- ProcessingIo
- stage-windows-migrator.mjs
- WorkProcessingStore
- dev.mjs
- devDependencies
- logger/src/index.ts
- fields.tsx
- sha256Hex
- 202611050007_work_pipeline/migration.sql
- LogReaderTests
- catalog-deletion.ts
- Runtime и диагностика
- smoke-windows-release.py
- 202611050001_document_vertical/migration.sql
- stage-windows-mineru.mjs
- mutations.test.tsx
- agents/index.ts
- Process
- RunDefinition
- http/route.ts
- teach/SKILL.md
- edit-values.test.ts
- call.ts
- exports
- routes/works/index.ts
- Codebase Design
- start.ts
- app.ts
- llm/tsconfig.json
- bfl/fields.ts
- unit-of-work.test.ts
- Решение
- ref_bun_test
- DocumentStore
- createQueryClient
- workspace-states.tsx
- modules/documents/index.ts
- Примеры v2
- Agent skills
- 202611170017_unified_processing/migration.sql
- session-gate.ts
- build-windows-web.mjs
- create-backend.ts
- deep-sky.ts
- 202611180018_work_deletion_and_listing/migration.sql
- documents.test.ts
- templates/index.ts
- During the session
- Anyko — брендбук
- "AnykoWorkspace"
- works.test.ts
- "WorkGeneration"
- ui/package.json
- Язык Anyko
- job-host.test.ts
- result-preview.tsx
- Работа агентов и независимая проверка
- Данные, доступ и фоновые задания
- 202611060012_work_agent_sessions/migration.sql
- connections/endpoints.ts
- check-project.mjs
- deleteCatalogDocument
- openapi.ts
- frontend.js
- work-analysis/index.ts
- HTML Report Format
- modules/connections/index.ts
- integration/idempotency.test.ts
- start-api.ts
- setup.ts
- Решение
- automatic-value.ts
- template.sh
- pdf_ocr.py
- startJobWorker
- runtime/jobs.ts
- smoke-windows-mineru.mjs
- review-cases/README.md
- FakeEventSource
- black-hole-renderer.ts
- ref_node_fs
- Ask Matt
- work-screen.tsx
- Направления развития Anyko
- Diagnosing Bugs
- ref_node_path
- e2e/tsconfig.json
- Test-Driven Development
- Process
- work-ports.ts
- ui/tsconfig.json
- scroll-sync.ts
- .test_two_matching_readings_preserve_number_and_a_conflict_is_excluded
- writing-for-agents/SKILL.md
- wayfinder/SKILL.md
- @tanstack/react-query
- Размещение основы в Dokploy
- server/session.test.ts
- "SourceDocument"
- to-spec/SKILL.md
- Triage
- Process
- stage-windows-web.mjs
- Каталог HTTP API
- <Questionnaire title>
- WorksModule
- DocumentDeps
- job-scope.ts
- WorkDeletionStore
- ProcessorReview
- test_processor.py
- DeliveryPort
- DocumentId
- work-view/index.ts
- Sections
- Process
- journeys.spec.ts
- hitl-loop.template.sh
- GLOSSARY.md Format
- implement-spec/SKILL.md
- CREDITS.md
- 0010-shared-source-document-catalog.md
- src/works/index.ts
- @tanstack/react-query
- document-viewer.tsx
- Principles
- Out-of-Scope Knowledge Base
- Examples
- paintBlackHole
- startBlackHole
- client.ts
- .render
- smoke-windows-mineru.mjs
- dependencies.md

## God Nodes (most connected - your core abstractions)
1. `WorkspaceScope` - 104 edges
2. `createBackend()` - 88 edges
3. `Button()` - 86 edges
4. `scripts` - 64 edges
5. `WorkId` - 54 edges
6. `callApi()` - 48 edges
7. `Notice()` - 47 edges
8. `@tanstack/react-query` - 46 edges
9. `Tx` - 46 edges
10. `createLogger()` - 36 edges

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

## Communities (229 total, 37 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.08
Nodes (23): @anyko/contracts, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form, @types/bun (+15 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "ref_bun_test"
Cohesion: 0.16
Nodes (13): createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root, createTerminalLog(), consume() (+5 more)

### Community 3 - "documents/module.ts"
Cohesion: 0.19
Nodes (18): failed, queued, store(), unused(), listDocuments(), readPosition(), listPendingDeletions(), DocumentDeps (+10 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "ref_react"
Cohesion: 0.10
Nodes (35): allKeys(), FactValues, sameFieldValue(), sameFieldValues(), sameRow(), mentions(), previewEntries(), FactConflict (+27 more)

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
Cohesion: 0.07
Nodes (31): actions, address(), boundedDirectories, collections, declaredOverlaps, entries, Entry, globals (+23 more)

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
Nodes (36): connections, Доверенный scope и права, FactsCommands, WorkRuns, ProcessingCommands, ProcessingQueries, attachDocuments(), bumpRevision() (+28 more)

### Community 21 - "mineru.ts"
Cohesion: 0.19
Nodes (13): formats, imageContainerFormat(), isDocx(), matchesSourceFormat(), sourceContentTypes, sourceFormatFromKey(), startsWith(), contentTypes (+5 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "ui/src/index.ts"
Cohesion: 0.09
Nodes (26): workDeletionQueryOptions(), Work, WorkDeletionDialog(), layouts, UnsavedNavigation(), filePlural, Flying, orbits (+18 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.14
Nodes (20): AcquireInput, AcquireOutcome, IdempotencyKeyRef, IdempotencyStore, StoredResponse, IdempotencyDeps, IdempotentCommand, IdempotentResult (+12 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "routes.ts"
Cohesion: 0.12
Nodes (19): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), WorkspaceSwitcher() (+11 more)

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
Cohesion: 0.07
Nodes (36): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), documentSummary(), workEventStream(), worksRoutes(), Область и права (+28 more)

### Community 38 - "WorkspaceScope"
Cohesion: 0.11
Nodes (16): createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts, GenerationQueries, GenerationRecord (+8 more)

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
Cohesion: 0.08
Nodes (25): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, @anyko/database, @anyko/llm, @anyko/logger (+17 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "facts-form.test.tsx"
Cohesion: 0.12
Nodes (15): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+7 more)

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
Cohesion: 0.08
Nodes (24): BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool(), DatabasePool (+16 more)

### Community 52 - "ids.ts"
Cohesion: 0.16
Nodes (16): authRoutes(), access, member, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor() (+8 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "create-backend.ts"
Cohesion: 0.07
Nodes (30): agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule(), DocumentParser, createArtifactRegistry(), createDeletionStore(), createReadyResults() (+22 more)

### Community 55 - "endpoint.ts"
Cohesion: 0.07
Nodes (31): contractModules, describedEndpoints(), NamedEndpoint, namedEndpoints(), HTTP, listDocumentPackages, packagesResponseSchema, endpoint (+23 more)

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "Первая вертикаль обработки документов"
Cohesion: 0.11
Nodes (17): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости (+9 more)

### Community 58 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 59 - "AGENTS.md"
Cohesion: 0.15
Nodes (8): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Бланки пакета банкротства

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

### Community 65 - "ref_zod"
Cohesion: 0.13
Nodes (18): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), generationFileSchema (+10 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "document-workspace.tsx"
Cohesion: 0.08
Nodes (53): invalidateDocumentCatalog(), RecognitionAction, requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion() (+45 more)

### Community 73 - "mineru.ts"
Cohesion: 0.15
Nodes (11): DocumentResult, box, coordinate, documentResultSchema, pdfOcrSchema, DocumentResultView, archiveLimitErrors, createMineruParser() (+3 more)

### Community 74 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 75 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 76 - "Устройство репозитория"
Cohesion: 0.15
Nodes (12): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия, Frontend, Как добавлять новое, Правила зависимостей (+4 more)

### Community 77 - "facts/index.ts"
Cohesion: 0.14
Nodes (20): confirmValues(), editValues(), readFacts(), Candidate, confirmFacts(), editFacts(), emptyFacts(), FactEvidence (+12 more)

### Community 78 - "modules/documents/index.ts"
Cohesion: 0.15
Nodes (25): Как добавлять, Как проверяются правила, AgentsModule, AuditModule, ConnectionsModule, ResourceLocks, DocumentsModule, FactsModule (+17 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "api/errors.ts"
Cohesion: 0.07
Nodes (34): Интерфейс, documentTexts, conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), Sync, FactsEditor() (+26 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "ProcessingIo"
Cohesion: 0.12
Nodes (13): Единый механизм запусков, Единые таблицы запусков, Восстановление и данные, Выкат #22 в окно обслуживания, Выкат заданий и очередей, Выкат общего каталога (#44), Начальная топология, Порядок выпуска (+5 more)

### Community 83 - "stage-windows-migrator.mjs"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "WorkProcessingStore"
Cohesion: 0.11
Nodes (6): isActive(), listRuns(), startRun(), WorkProcessingStore, createProcessingModule(), ProcessingDeps

### Community 85 - "dev.mjs"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "logger/src/index.ts"
Cohesion: 0.10
Nodes (24): createApp(), WorkHttpOptions, Analyze, appWith(), logger, memberAccess, memberSession, memoryIdempotency() (+16 more)

### Community 88 - "fields.tsx"
Cohesion: 0.06
Nodes (47): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), useRevokeLlmSettings() (+39 more)

### Community 89 - "sha256Hex"
Cohesion: 0.31
Nodes (6): DocumentImage, canonicalize(), fingerprintInput(), ADR-0009, sha256Hex(), ADR-0009

### Community 90 - "202611050007_work_pipeline/migration.sql"
Cohesion: 0.13
Nodes (28): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkDocument" (+20 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "catalog-deletion.ts"
Cohesion: 0.08
Nodes (49): Ошибки, Ошибки, record(), Connection, createDocumentCommands(), lockLiveDocumentForResponse(), Registration, createDocumentReadModel() (+41 more)

### Community 93 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 94 - "smoke-windows-release.py"
Cohesion: 0.13
Nodes (8): descendant_handles(), initdb_diagnostic(), ModelHandler, start(), child(), dead(), main(), supervisor()

### Community 95 - "202611050001_document_vertical/migration.sql"
Cohesion: 0.13
Nodes (25): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+17 more)

### Community 96 - "stage-windows-mineru.mjs"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "mutations.test.tsx"
Cohesion: 0.22
Nodes (17): renderWork(), source, result, serveWork(), wrapperFor(), serveWork(), installEventSource(), json() (+9 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.13
Nodes (14): Контрольные примеры для reviewer, AgentSessionStore, Reconciliation, reconciliationSchema, AgentDocument, AgentsPorts, AgentUsage, DocumentAgents (+6 more)

### Community 99 - "Process"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 100 - "RunDefinition"
Cohesion: 0.40
Nodes (3): CommonDefinition, RunDefinition, ScheduledDefinition

### Community 101 - "http/route.ts"
Cohesion: 0.11
Nodes (29): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+21 more)

### Community 102 - "teach/SKILL.md"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 103 - "edit-values.test.ts"
Cohesion: 0.23
Nodes (11): WorksPorts, WorkSummary, editValues(), ports(), scenario(), unused(), unusedFactsInternal, unusedWorkInternal (+3 more)

### Community 104 - "call.ts"
Cohesion: 0.11
Nodes (26): WorkLive, documentPackageKeys, workKeys, BodyField, CallArgs, callFileApi(), CallOptions, encodeBody() (+18 more)

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "routes/works/index.ts"
Cohesion: 0.05
Nodes (51): Sent, session, fieldKeySchema, fieldValueSchema, fieldValuesSchema, documentSchema, AgentSession, AgentSessionContext (+43 more)

### Community 107 - "Codebase Design"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 108 - "start.ts"
Cohesion: 0.08
Nodes (27): AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid (+19 more)

### Community 109 - "app.ts"
Cohesion: 0.10
Nodes (33): ApiInput, AppOptions, registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind, noStore() (+25 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "bfl/fields.ts"
Cohesion: 0.11
Nodes (23): agentSessionSchema, factsSchema, templateData(), block, cell, document, paragraph, row (+15 more)

### Community 112 - "unit-of-work.test.ts"
Cohesion: 0.13
Nodes (18): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+10 more)

### Community 113 - "Решение"
Cohesion: 0.08
Nodes (30): GET(), LlmSettings, HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов (+22 more)

### Community 114 - "ref_bun_test"
Cohesion: 0.11
Nodes (18): configured, json(), renderSettings(), serveSaveAnswer(), serveSettings(), sessionWith(), Settings, createdWorkView (+10 more)

### Community 116 - "createQueryClient"
Cohesion: 0.16
Nodes (13): manrope, metadata, onest, RootLayout(), Providers(), deletionImpactToken, renderWorkspace(), Status (+5 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "modules/documents/index.ts"
Cohesion: 0.11
Nodes (13): Artifact, ArtifactRegistry, DocumentDeletionConfirmation, DocumentListFilters, DocumentListInput, DocumentPage, DocumentPosition, DocumentStatus (+5 more)

### Community 119 - "Примеры v2"
Cohesion: 0.22
Nodes (9): C1, C2, C3, C4, C5, C6, C7, C8 (+1 more)

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
Cohesion: 0.12
Nodes (21): createIdempotencyMaintenanceStore(), IdempotencyMaintenanceStore, ProcessingClaim, ProcessingStore, createProcessingService(), activeAttempt(), claimRun(), documentPolicy (+13 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "202611180018_work_deletion_and_listing/migration.sql"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 127 - "documents.test.ts"
Cohesion: 0.05
Nodes (38): SourceStorage, createSourceCleanup(), BackendConfig, connectionApi(), db, encryptionKey, owned, pool (+30 more)

### Community 128 - "templates/index.ts"
Cohesion: 0.17
Nodes (12): bankruptcyPackage, historicalPackage, knownPackages, previousPackage, templateBytes(), DocumentPackage, documentPackageSchema, bytes (+4 more)

### Community 129 - "During the session"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 130 - "Anyko — брендбук"
Cohesion: 0.10
Nodes (17): This is NOT the Next.js you know, Архитектура, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система (+9 more)

### Community 131 - ""AnykoWorkspace""
Cohesion: 0.15
Nodes (17): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+9 more)

### Community 132 - "works.test.ts"
Cohesion: 0.07
Nodes (26): workspaceWithWork(), memberScope(), upload(), waitFor(), actualPool, agents, apiBackend, create() (+18 more)

### Community 133 - ""WorkGeneration""
Cohesion: 0.33
Nodes (9): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+1 more)

### Community 137 - "ui/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @base-ui/react, lucide-react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form, @types/react (+23 more)

### Community 138 - "Язык Anyko"
Cohesion: 0.50
Nodes (4): Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "job-host.test.ts"
Cohesion: 0.08
Nodes (21): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), resultSchema, runDiagnostic(), createWorkerRuntime(), envelope (+13 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "Данные, доступ и фоновые задания"
Cohesion: 0.20
Nodes (10): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание (+2 more)

### Community 143 - "202611060012_work_agent_sessions/migration.sql"
Cohesion: 0.46
Nodes (7): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx

### Community 144 - "connections/endpoints.ts"
Cohesion: 0.19
Nodes (11): ConnectionHttpOptions, connectionKeys, LlmSettingsInput, ConnectionSettingsApi, getLlmSettings, revokeLlmSettings, saveLlmSettings, ADR-0009 (+3 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 146 - "deleteCatalogDocument"
Cohesion: 0.21
Nodes (5): deleteCatalogDocument(), DeletionPorts, ImpactPorts, impactToken(), readDeletionImpact()

### Community 147 - "openapi.ts"
Cohesion: 0.24
Nodes (11): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), WorkErrors (+3 more)

### Community 148 - "frontend.js"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "work-analysis/index.ts"
Cohesion: 0.14
Nodes (25): combineCandidates(), selectSessionCandidates(), agentSessionContextSchema, DocumentAnalysis, findFactConflicts(), mergeCandidates(), generateDocument(), WorkRunRecord (+17 more)

### Community 150 - "HTML Report Format"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 151 - "modules/connections/index.ts"
Cohesion: 0.15
Nodes (11): input, currentConnection(), LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection(), saveConnection() (+3 more)

### Community 152 - "integration/idempotency.test.ts"
Cohesion: 0.18
Nodes (8): api, clock, current, db, logger, owned, pool, store

### Community 153 - "start-api.ts"
Cohesion: 0.14
Nodes (14): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), BackendConfigError, BackendConfigErrorCode, backendConfigSchema (+6 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.22
Nodes (15): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), automaticValue(), Candidate, checksum(), date() (+7 more)

### Community 158 - "template.sh"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "startJobWorker"
Cohesion: 0.13
Nodes (17): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), currentEnvelope, identity, JobDelivery, JobRuntime (+9 more)

### Community 161 - "runtime/jobs.ts"
Cohesion: 0.24
Nodes (13): Фоновые задания, idempotencyCleanupJob(), createIdempotencyMaintenance(), defineJob(), JobRegistry, RunPolicy, ExecutionScope, createJobRegistry() (+5 more)

### Community 162 - "smoke-windows-mineru.mjs"
Cohesion: 0.29
Nodes (3): components, env, root

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.28
Nodes (4): DiskProjection, HoleFrame, createGalaxyRenderer(), createLensedSky()

### Community 168 - "ref_node_fs"
Cohesion: 0.11
Nodes (10): assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, env, lock (+2 more)

### Community 169 - "Ask Matt"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 170 - "work-screen.tsx"
Cohesion: 0.08
Nodes (50): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), fail() (+42 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "Diagnosing Bugs"
Cohesion: 0.13
Nodes (14): Completion criterion: a tight loop that goes red, Diagnosing Bugs, Minimise, Non-deterministic bugs, Phase 1: Build a feedback loop, Phase 2: Reproduce + minimise, Phase 3: Hypothesise, Phase 4: Instrument (+6 more)

### Community 173 - "ref_node_path"
Cohesion: 0.12
Nodes (10): config, child, metadata, mineru, path, python, root, links (+2 more)

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 175 - "Test-Driven Development"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 176 - "Process"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 177 - "work-ports.ts"
Cohesion: 0.40
Nodes (4): StepOutput, stepOutputSchema, workRunSchema, workStepSchema

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "scroll-sync.ts"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 181 - "writing-for-agents/SKILL.md"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 182 - "wayfinder/SKILL.md"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 183 - "@tanstack/react-query"
Cohesion: 0.17
Nodes (18): WorkspaceLayout(), AppShell(), renderShell(), user, session, session, sessionKeys, sessionQueryOptions() (+10 more)

### Community 184 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 186 - ""SourceDocument""
Cohesion: 0.14
Nodes (12): "SourceDocument", SourceDocument_sourceKey_key, SourceDocument_workspaceId_createdAt_idx, SourceDocument_workspaceId_id_key, SourceDocument_workspaceId_requestKey_key, SourceDocument_deletedAt_purgedAt_idx, SourceDocument_active_filename_trgm_idx, SourceDocument_active_format_page_idx (+4 more)

### Community 187 - "to-spec/SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 188 - "Triage"
Cohesion: 0.22
Nodes (9): Invocation, Needs-info template, Quick state override, Reference docs, Resuming a previous session, Roles, Show what needs attention, Triage (+1 more)

### Community 189 - "Process"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Каталог HTTP API"
Cohesion: 0.40
Nodes (5): catalog, connections, documents, session, Каталог HTTP API

### Community 192 - "<Questionnaire title>"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 193 - "WorksModule"
Cohesion: 0.20
Nodes (27): works, requirePackage(), WorkError, downloadResult(), createWorkGeneration(), startGeneration(), requireCleanSources(), requireIdle() (+19 more)

### Community 194 - "DocumentDeps"
Cohesion: 0.46
Nodes (5): readAnalysis(), readArtifact(), readResult(), InternalDocumentRef, InternalResultRef

### Community 195 - "job-scope.ts"
Cohesion: 0.27
Nodes (6): createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, issueExecutionScope()

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 202 - "DocumentId"
Cohesion: 0.19
Nodes (6): DocumentDeletionImpact, DocumentView, DocumentsCommands, DocumentsInternal, DocumentsQueries, DocumentId

### Community 204 - "work-view/index.ts"
Cohesion: 0.51
Nodes (6): availablePackages(), getImage(), getResult(), getSource(), requireAttachedDocument(), createWorkView()

### Community 205 - "Sections"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 206 - "Process"
Cohesion: 0.25
Nodes (6): 1. Scope the procedure, 2. Map each stage's journey, 3. Author the wizard, 4. Verify and hand off, Process, Wizard

### Community 207 - "journeys.spec.ts"
Cohesion: 0.33
Nodes (4): @playwright/test, ObservedEventSource, required(), signIn()

### Community 209 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 210 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 221 - "src/works/index.ts"
Cohesion: 0.07
Nodes (51): filled(), ReviewField, reviewFields(), ReviewFilter, same(), FactsForm, CandidateList(), ConflictValue() (+43 more)

### Community 222 - "@tanstack/react-query"
Cohesion: 0.11
Nodes (40): RecognitionPage(), ShellFrame(), WorkNotFound(), WorkListPage(), SelectedCatalogFiles(), DocumentWorkspace(), OcrRevisionAction(), useCreateWork() (+32 more)

### Community 223 - "document-viewer.tsx"
Cohesion: 0.07
Nodes (42): DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), recognitionStatusQueryOptions(), recognitionRetryText, isRecognizing(), recognitionPollInterval(), recognitionPollMs (+34 more)

### Community 224 - "Principles"
Cohesion: 0.29
Nodes (8): Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Explicit scope boundaries, Principles, paint(), schedule(), tick()

### Community 225 - "Out-of-Scope Knowledge Base"
Cohesion: 0.29
Nodes (4): Directory structure, File format, Out-of-Scope Knowledge Base, Prior requests

### Community 226 - "Examples"
Cohesion: 0.29
Nodes (7): Bad agent brief, Examples, Good agent brief (bug), Good agent brief (enhancement), Good agent brief (PR), Template, Writing Agent Briefs

### Community 228 - "paintBlackHole"
Cohesion: 0.47
Nodes (5): paintBlackHole(), annulus(), disk(), drawSpacecraft(), project()

### Community 229 - "startBlackHole"
Cohesion: 0.53
Nodes (4): startBlackHole(), paint(), tick(), visibility()

### Community 230 - "client.ts"
Cohesion: 0.13
Nodes (12): dynamic, relay(), register(), HttpFetch, RequestOptions, proxyApiRequest(), requestHeaders, responseHeaders (+4 more)

### Community 232 - ".render"
Cohesion: 0.25
Nodes (6): RenderBoundary, Задания, Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 237 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1794 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `routes/documents/index.ts`, `Решение`, `Первая вертикаль обработки документов`, `LogReaderTests`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `journeys.spec.ts` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._