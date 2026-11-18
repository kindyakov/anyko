# Graph Report - issue-31-fact-discrepancy  (2026-11-18)

## Corpus Check
- 710 files · ~310,028 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: (none) 7, .ttf 5, .example 4)

## Summary
- 3950 nodes · 9720 edges · 214 communities (183 shown, 31 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 241 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `322e81fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- run-local.test.mjs
- work-screen.tsx
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- works/schemas.ts
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
- app.ts
- exports
- web/tsconfig.json
- ui/src/index.ts
- Проверка качества
- Process
- idempotency/index.ts
- logger/package.json
- app-shell.tsx
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
- isolation.test.ts
- llm/package.json
- work-store.ts
- ref_bun_test
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
- unit-of-work.ts
- scripts
- Проверка тестов, написанных агентом
- Устройство репозитория
- facts/index.ts
- processing/index.ts
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
- work-pipeline.md
- teach/SKILL.md
- LogReaderTests
- Серверная часть
- Runtime и диагностика
- smoke-windows-release.py
- Codebase Design
- stage-windows-mineru.mjs
- mutations.test.tsx
- agents/index.ts
- infrastructure/auth.ts
- ref_zod
- http/route.ts
- start-worker.ts
- edit-values.test.ts
- start-api.ts
- exports
- works/endpoints.ts
- facts-form.test.tsx
- start.ts
- tests/route.test.ts
- llm/tsconfig.json
- bfl/fields.ts
- dependencies.md
- Решение
- support/endpoints.ts
- DocumentStore
- openapi.ts
- workspace-states.tsx
- audit/index.ts
- Примеры v2
- Agent skills
- During the session
- session-gate.ts
- build-windows-web.mjs
- create-backend.ts
- deep-sky.ts
- HTML Report Format
- endpoint.ts
- templates/schemas.ts
- Feature-based web и модульный backend с ports/adapters
- connection-settings.tsx
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
- access.test.ts
- check-project.mjs
- modules/documents/index.ts
- Process
- eslint.config.mjs
- templates/index.ts
- writing-for-agents/SKILL.md
- modules/connections/index.ts
- connection-settings.test.tsx
- runtime/index.ts
- setup.ts
- Решение
- automatic-value.ts
- Размещение и эксплуатация
- pdf_ocr.py
- app/layout.tsx
- wayfinder/SKILL.md
- smoke-windows-mineru.mjs
- unit-of-work.test.ts
- provision.ts
- FakeEventSource
- to-spec/SKILL.md
- black-hole-renderer.ts
- ref_node_fs
- Triage
- src/works/index.ts
- Направления развития Anyko
- scroll-sync.ts
- ref_node_path
- e2e/tsconfig.json
- DeliveryPort
- journeys.spec.ts
- job-host.test.ts
- ui/tsconfig.json
- Anyko
- PdfRecoveryReview
- Process
- <Questionnaire title>
- Principles
- Размещение основы в Dokploy
- Process
- Out-of-Scope Knowledge Base
- Examples
- Работы, модели и заполнение документа
- Tx
- stage-windows-web.mjs
- Каталог HTTP API
- smoke-windows-components.mjs
- Sections
- processing/module.ts
- ExecutionScope
- paintBlackHole
- startBlackHole
- ProcessorReview
- VisualExportReview
- startJobWorker
- prepare-storage.ts
- .confirm
- hitl-loop.template.sh
- GLOSSARY.md Format
- implement-spec/SKILL.md
- CREDITS.md

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
- `Правила зависимостей` --references--> `Tx`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/platform/transactions/index.ts
- `Композиция процесса` --references--> `createBackend()`  [INFERRED]
  docs/adr/0009-backend-architecture.md → packages/backend/src/runtime/create-backend.ts
- `Тесты` --references--> `createBackend()`  [INFERRED]
  docs/engineering/backend.md → packages/backend/src/runtime/create-backend.ts

## Import Cycles
- None detected.

## Communities (214 total, 31 thin omitted)

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
Cohesion: 0.08
Nodes (47): WorkPage(), Hero(), Stepper(), Document, LiveState, WorkBody(), deleteDocument(), fail() (+39 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "works/schemas.ts"
Cohesion: 0.05
Nodes (60): allKeys(), FactValues, sameFieldValue(), sameFieldValues(), sameRow(), mentions(), previewEntries(), FactConflict (+52 more)

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

### Community 20 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "app.ts"
Cohesion: 0.16
Nodes (24): ApiInput, AppOptions, registerScopedRoutes(), versionedRoutes(), noStore(), originGuard(), sessionGuard(), workspaceScopeGuard() (+16 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "ui/src/index.ts"
Cohesion: 0.06
Nodes (53): WorkListPage(), Files(), Generation, generationTones, WorkResults(), useCreateWork(), documentPackagesQueryOptions(), worksQueryOptions() (+45 more)

### Community 25 - "Проверка качества"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Process"
Cohesion: 0.07
Nodes (26): document(), 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype (+18 more)

### Community 27 - "idempotency/index.ts"
Cohesion: 0.06
Nodes (48): Row, HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, canonicalize() (+40 more)

### Community 29 - "logger/package.json"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "app-shell.tsx"
Cohesion: 0.12
Nodes (27): LogoLink(), LegacyRecognitionPage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), WorkspaceLayout(), AppShell() (+19 more)

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
Nodes (26): documentSummary(), documentImageLimit, listDocumentPackages, packagesResponseSchema, json(), ADR-0008, ADR-0009, workspaceIdSchema (+18 more)

### Community 38 - "WorkspaceScope"
Cohesion: 0.05
Nodes (52): Доверенный scope и права, Область и права, createGeneration(), listGenerations(), readGeneration(), GenerationCommands, GenerationFile, GenerationPorts (+44 more)

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
Nodes (25): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, @anyko/database, @anyko/llm, @anyko/logger (+17 more)

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "call.ts"
Cohesion: 0.06
Nodes (54): RecognitionAction, refreshList(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument(), useUploadDocument(), waitForDeletion() (+46 more)

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
Nodes (21): BackendDependencies, config, countingSeams(), logger, createDatabase(), createDatabasePool(), createLockPool(), DatabasePool (+13 more)

### Community 52 - "isolation.test.ts"
Cohesion: 0.17
Nodes (14): access, member, ownerOnlyRights, rightsForRole(), AccessSession, issueScope(), scopeFor(), scopeWith() (+6 more)

### Community 53 - "llm/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "work-store.ts"
Cohesion: 0.14
Nodes (18): ProcessingClaim, ProcessingStore, StepOutput, stepOutputSchema, workRunSchema, workStepSchema, activeAttempt(), claimRun() (+10 more)

### Community 55 - "ref_bun_test"
Cohesion: 0.21
Nodes (4): Call, session, expectFocused(), react-dom

### Community 56 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 57 - "MinerU и RouterAI: граница совместимости"
Cohesion: 0.17
Nodes (10): HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости, Вывод, Два разных контракта, Практический вариант для Anyko, Что проверено, Контракт процессора, Локальный stateless MinerU (+2 more)

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
Cohesion: 0.15
Nodes (6): model_path(), valid_model(), install(), main(), port(), ready()

### Community 65 - "mastra.ts"
Cohesion: 0.13
Nodes (15): createDocumentAgents(), descriptionSchema, extractionSchema, createReconciliationAgent(), invalidResponse(), retryVisionResponse(), failureCode(), legacyFieldKeys (+7 more)

### Community 66 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @anyko/database, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter, docxtemplater (+6 more)

### Community 71 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "document-workspace.tsx"
Cohesion: 0.08
Nodes (38): RecognitionPage(), documentsQueryOptions(), describeDocumentError(), documentTexts, recognitionFailureText(), recognitionRetryCode, recognitionRetryText, recognitionPollInterval() (+30 more)

### Community 73 - "unit-of-work.ts"
Cohesion: 0.20
Nodes (16): record(), createDocumentCommands(), createDocumentReadModel(), legacyPdf(), view(), nextRunRevision(), Connection, createProcessingCommands() (+8 more)

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
Nodes (19): works, confirmValues(), editValues(), readFacts(), comparableFactValue(), confirmFacts(), editFacts(), emptyFacts() (+11 more)

### Community 78 - "processing/index.ts"
Cohesion: 0.13
Nodes (46): AgentsModule, ConnectionsModule, ResourceLocks, DocumentsModule, FactsModule, GenerationModule, WorkRuns, ProcessingInternal (+38 more)

### Community 79 - "agent-github.mjs"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "client.ts"
Cohesion: 0.06
Nodes (35): This is NOT the Next.js you know, Архитектура, Интерфейс, dynamic, relay(), register(), HttpFetch, request() (+27 more)

### Community 81 - "boundaries.test.ts"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "ProcessingIo"
Cohesion: 0.29
Nodes (5): Единый механизм запусков, Единые таблицы запусков, Выкат #22 в окно обслуживания, Выкат заданий и очередей, ProcessingIo

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
Nodes (26): createApp(), authRoutes(), WorkHttpOptions, Analyze, appWith(), logger, memberAccess, memberSession (+18 more)

### Community 88 - "api/errors.ts"
Cohesion: 0.10
Nodes (23): conflictSummary(), describeFactsSaveError(), factsSaveTexts, fieldsWord(), uploadFailureMessage(), uploadTexts, workCommandTexts, ApiError (+15 more)

### Community 89 - "work-pipeline.md"
Cohesion: 0.25
Nodes (4): Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Бланки пакета банкротства

### Community 90 - "teach/SKILL.md"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "LogReaderTests"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "Серверная часть"
Cohesion: 0.15
Nodes (14): GET(), LlmSettings, formData(), Ошибки, Как добавлять, Как проверяются правила, Ошибки, Повтор команд и журнал действий (+6 more)

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

### Community 97 - "mutations.test.tsx"
Cohesion: 0.21
Nodes (16): renderWork(), source, result, serveWork(), wrapperFor(), serveWork(), installEventSource(), json() (+8 more)

### Community 98 - "agents/index.ts"
Cohesion: 0.12
Nodes (19): AgentSessionStore, combineCandidates(), Reconciliation, reconciliationSchema, selectSessionCandidates(), AgentDocument, AgentsPorts, AgentUsage (+11 more)

### Community 99 - "infrastructure/auth.ts"
Cohesion: 0.22
Nodes (9): AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), config, db, pool, redis (+1 more)

### Community 100 - "ref_zod"
Cohesion: 0.15
Nodes (19): idempotencyCleanupJob(), CommonDefinition, currentEnvelope, defineJob(), identity, JobDelivery, RetryPolicy, RunDefinition (+11 more)

### Community 101 - "http/route.ts"
Cohesion: 0.12
Nodes (27): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+19 more)

### Community 102 - "start-worker.ts"
Cohesion: 0.14
Nodes (15): parseBackendEnv(), schema, parseWorkerConfig(), startWorker(), createWorkerRuntime(), backendEnv, worker, BackendConfigError (+7 more)

### Community 103 - "edit-values.test.ts"
Cohesion: 0.31
Nodes (8): failureOf(), ports(), scenario(), unused(), unusedFactsInternal, unusedWorkInternal, work, WORK_ID

### Community 104 - "start-api.ts"
Cohesion: 0.33
Nodes (5): parseBackendEnv(), schema, parseApiConfig(), schema, startApi()

### Community 105 - "exports"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "works/endpoints.ts"
Cohesion: 0.10
Nodes (20): Sent, session, analyzeWork, confirmWork, createWork, deleteWork, downloadGeneratedFile, editWork (+12 more)

### Community 107 - "facts-form.test.tsx"
Cohesion: 0.12
Nodes (16): FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith(), WorkJson (+8 more)

### Community 108 - "start.ts"
Cohesion: 0.11
Nodes (18): E2E_QUEUE_PREFIX, parseE2eConfig(), schema, valid, agents, api, config, env (+10 more)

### Community 109 - "tests/route.test.ts"
Cohesion: 0.09
Nodes (22): transportErrorCodes, errorHandling(), statusByKind, safeMethods, requestContext(), attachRequestState(), requestState, states (+14 more)

### Community 110 - "llm/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "bfl/fields.ts"
Cohesion: 0.20
Nodes (11): candidateSchema, collectionLabels, fieldKeySchema, FieldRow, fieldRowSchema, fieldValueIssue(), fieldValueSchema, fieldValuesSchema (+3 more)

### Community 113 - "Решение"
Cohesion: 0.16
Nodes (13): HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контекст, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Последствия (+5 more)

### Community 114 - "support/endpoints.ts"
Cohesion: 0.26
Nodes (10): RouteEnv, contractModules, describedEndpoints(), NamedEndpoint, namedEndpoints(), endpoint, isEndpoint(), apiCatalogIsCurrent() (+2 more)

### Community 116 - "openapi.ts"
Cohesion: 0.22
Nodes (12): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), DocumentErrors (+4 more)

### Community 117 - "workspace-states.tsx"
Cohesion: 0.22
Nodes (9): WorkspaceLoading(), WorkspaceUnavailable(), RootError(), RecognitionError(), Loading(), ConnectionsError(), Loading(), WorksError() (+1 more)

### Community 118 - "audit/index.ts"
Cohesion: 0.26
Nodes (9): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+1 more)

### Community 119 - "Примеры v2"
Cohesion: 0.15
Nodes (12): C1, C2, C3, C4, C5, C6, C7, C8 (+4 more)

### Community 120 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 121 - "During the session"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "session-gate.ts"
Cohesion: 0.18
Nodes (12): HomePage(), decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure (+4 more)

### Community 124 - "create-backend.ts"
Cohesion: 0.04
Nodes (56): agentSessionStoreFor(), createAgentSessionStore(), createAgentsModule(), createAuditModule(), DocumentParser, SourceStorage, createArtifactRegistry(), Connection (+48 more)

### Community 125 - "deep-sky.ts"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "HTML Report Format"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "endpoint.ts"
Cohesion: 0.11
Nodes (19): HTTP, EndpointSpec, endpointTag, EventsResponse, eventStream(), fileDownload(), FileResponse, Idempotency (+11 more)

### Community 128 - "templates/schemas.ts"
Cohesion: 0.16
Nodes (12): block, cell, document, DocumentPackage, documentPackageSchema, paragraph, row, bytes (+4 more)

### Community 129 - "Feature-based web и модульный backend с ports/adapters"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 130 - "connection-settings.tsx"
Cohesion: 0.07
Nodes (40): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), useRevokeLlmSettings() (+32 more)

### Community 131 - "template.sh"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "works.test.ts"
Cohesion: 0.07
Nodes (26): workspaceWithWork(), memberScope(), upload(), waitFor(), actualPool, agents, apiBackend, create() (+18 more)

### Community 133 - "work-list.test.tsx"
Cohesion: 0.16
Nodes (11): renderWorkspace(), Status, createdWorkView, existingWork, json(), packages, serveWorkList(), template (+3 more)

### Community 134 - "Ask Matt"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "documents.test.ts"
Cohesion: 0.13
Nodes (13): startDocumentWorker(), api, contentTypes, db, files, logger, owned, pdf (+5 more)

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
Cohesion: 0.15
Nodes (24): DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks(), DocumentViewer(), Mode (+16 more)

### Community 140 - "result-preview.tsx"
Cohesion: 0.22
Nodes (8): cyrillicMathMacros, schema, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm, remark-math

### Community 141 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 142 - "Данные, доступ и фоновые задания"
Cohesion: 0.22
Nodes (9): member(), Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Отмена, удаление и аудит, Ревизии подключения модели, Реестр заданий и обслуживание, Снимки конфигурации и стоимость (+1 more)

### Community 143 - "Test-Driven Development"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "access.test.ts"
Cohesion: 0.13
Nodes (13): connectionKeys, LlmSettingsInput, getLlmSettings, revokeLlmSettings, saveLlmSettings, ADR-0009, llmSettingsInputSchema, llmSettingsResponseSchema (+5 more)

### Community 145 - "check-project.mjs"
Cohesion: 0.17
Nodes (7): documents, errors, manifests, markdownFiles(), root, hook, root

### Community 146 - "modules/documents/index.ts"
Cohesion: 0.05
Nodes (62): failed, queued, store(), unused(), listDocuments(), readPosition(), listPendingDeletions(), Artifact (+54 more)

### Community 147 - "Process"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "eslint.config.mjs"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "templates/index.ts"
Cohesion: 0.11
Nodes (31): DocumentAnalysis, factsSchema, generateDocument(), WorkRunRecord, bankruptcyPackage, historicalPackage, knownPackages, previousPackage (+23 more)

### Community 150 - "writing-for-agents/SKILL.md"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "modules/connections/index.ts"
Cohesion: 0.15
Nodes (12): AuditModule, input, currentConnection(), LlmConfiguration, LlmSettingsStore, revokeConnection(), LlmSettingsInput, persistConnection() (+4 more)

### Community 152 - "connection-settings.test.tsx"
Cohesion: 0.14
Nodes (20): renderShell(), user, session, configured, json(), renderSettings(), serveSaveAnswer(), serveSettings() (+12 more)

### Community 153 - "runtime/index.ts"
Cohesion: 0.10
Nodes (15): BackendConfig, connectionApi(), db, encryptionKey, owned, pool, settingsBackends, users (+7 more)

### Community 155 - "Решение"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 157 - "automatic-value.ts"
Cohesion: 0.21
Nodes (16): amount(), attestedAmount(), attestedDate(), attestedIdentifier(), automaticValue(), Candidate, checksum(), date() (+8 more)

### Community 158 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 159 - "pdf_ocr.py"
Cohesion: 0.28
Nodes (12): comparable_text(), markdown_row(), needs_recovery(), normalized(), number_notation(), overlaps_block(), read_lines(), reading_rows() (+4 more)

### Community 160 - "app/layout.tsx"
Cohesion: 0.29
Nodes (6): manrope, metadata, onest, RootLayout(), Providers(), katex

### Community 161 - "wayfinder/SKILL.md"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 162 - "smoke-windows-mineru.mjs"
Cohesion: 0.17
Nodes (8): metadata, python, pythonRelative, root, source, downloads, output, sources

### Community 163 - "unit-of-work.test.ts"
Cohesion: 0.18
Nodes (8): config, db, failing, logger, normal, owned, pool, unusedStorage

### Community 164 - "provision.ts"
Cohesion: 0.33
Nodes (7): Connection, connectionsStoreFor(), createConnectionsStore(), provisionLlm(), createModelGateway(), env, schema

### Community 166 - "to-spec/SKILL.md"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "black-hole-renderer.ts"
Cohesion: 0.28
Nodes (4): DiskProjection, HoleFrame, createGalaxyRenderer(), createLensedSky()

### Community 168 - "ref_node_fs"
Cohesion: 0.11
Nodes (10): assetTypes, { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, output, env, lock (+2 more)

### Community 169 - "Triage"
Cohesion: 0.22
Nodes (9): Invocation, Needs-info template, Quick state override, Reference docs, Resuming a previous session, Roles, Show what needs attention, Triage (+1 more)

### Community 170 - "src/works/index.ts"
Cohesion: 0.08
Nodes (40): filled(), ReviewField, reviewFields(), ReviewFilter, same(), FactsForm, Sync, CandidateList() (+32 more)

### Community 171 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 172 - "scroll-sync.ts"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 173 - "ref_node_path"
Cohesion: 0.12
Nodes (10): config, child, metadata, mineru, path, python, root, links (+2 more)

### Community 174 - "e2e/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 176 - "journeys.spec.ts"
Cohesion: 0.25
Nodes (5): sessionCookieNames, @playwright/test, ObservedEventSource, required(), signIn()

### Community 177 - "job-host.test.ts"
Cohesion: 0.10
Nodes (13): resultSchema, runDiagnostic(), envelope, State, logger, createQueueProbe(), bullmq, backend (+5 more)

### Community 178 - "ui/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "Anyko"
Cohesion: 0.50
Nodes (4): Anyko, Запуск и диагностика, Локальная сборка для Windows, Разработка каркаса

### Community 181 - "Process"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "<Questionnaire title>"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - "Principles"
Cohesion: 0.29
Nodes (8): Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Explicit scope boundaries, Principles, paint(), schedule(), tick()

### Community 184 - "Размещение основы в Dokploy"
Cohesion: 0.33
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 185 - "Process"
Cohesion: 0.25
Nodes (6): 1. Scope the procedure, 2. Map each stage's journey, 3. Author the wizard, 4. Verify and hand off, Process, Wizard

### Community 186 - "Out-of-Scope Knowledge Base"
Cohesion: 0.29
Nodes (4): Directory structure, File format, Out-of-Scope Knowledge Base, Prior requests

### Community 187 - "Examples"
Cohesion: 0.29
Nodes (7): Bad agent brief, Examples, Good agent brief (bug), Good agent brief (enhancement), Good agent brief (PR), Template, Writing Agent Briefs

### Community 188 - "Работы, модели и заполнение документа"
Cohesion: 0.29
Nodes (7): Агентский контекст и данные, Владельцы и исполнение, Локальный запуск и доказательства, Повторы визуального анализа, Полное удаление и восстановление, Постоянный контекст работы, Работы, модели и заполнение документа

### Community 190 - "stage-windows-web.mjs"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 191 - "Каталог HTTP API"
Cohesion: 0.40
Nodes (5): catalog, connections, documents, session, Каталог HTTP API

### Community 192 - "smoke-windows-components.mjs"
Cohesion: 0.29
Nodes (3): components, env, root

### Community 193 - "Sections"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 194 - "processing/module.ts"
Cohesion: 0.60
Nodes (4): isActive(), listRuns(), startRun(), createProcessingModule()

### Community 195 - "ExecutionScope"
Cohesion: 0.14
Nodes (10): RenderBoundary, Фоновые задания, createJobProcessing(), JobRunReader, SavedJobRun, run, JobEnvelope, JobRegistry (+2 more)

### Community 196 - "paintBlackHole"
Cohesion: 0.47
Nodes (5): paintBlackHole(), annulus(), disk(), drawSpacecraft(), project()

### Community 197 - "startBlackHole"
Cohesion: 0.53
Nodes (4): startBlackHole(), paint(), tick(), visibility()

### Community 198 - "ProcessorReview"
Cohesion: 0.16
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 200 - "startJobWorker"
Cohesion: 0.17
Nodes (12): schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Задания, JobRuntime, parseJobEnvelope(), parseWorkerQueues() (+4 more)

### Community 202 - ".confirm"
Cohesion: 0.50
Nodes (4): Проектирование адресов, HTTP, SSE и настройки, FactsCommands, analyze()

### Community 203 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

## Knowledge Gaps
- **149 isolated node(s):** `@anyko/backend`, `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1763 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `endpoint.ts` to `http/route.ts`, `WorkspaceScope`, `idempotency/index.ts`, `LogReaderTests`, `Серверная часть`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/backend`, `@anyko/logger`, `zod` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `journeys.spec.ts` to `package.json`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `createBackend()` (e.g. with `Композиция процесса` and `Последствия`) actually correct?**
  _`createBackend()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._