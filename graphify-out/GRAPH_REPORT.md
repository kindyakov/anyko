# Graph Report - spec84-85  (2026-11-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 5640 nodes · 15510 edges · 258 communities (209 shown, 49 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 318 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `57e73306`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 29
- Community 30
- Community 31
- Community 33
- Community 34
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 155
- Community 156
- Community 159
- Community 161
- Community 164
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 173
- Community 174
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 215
- Community 216
- Community 217
- Community 219
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 232
- Community 233
- Community 234
- Community 235
- Community 237
- Community 238
- Community 247
- Community 251
- Community 252
- Community 255
- Community 257
- Community 259
- Community 260
- Community 261
- Community 264
- Community 265
- Community 267
- Community 269
- Community 270
- Community 271
- Community 272
- Community 274
- Community 276

## God Nodes (most connected - your core abstractions)
1. `Button()` - 124 edges
2. `WorkspaceScope` - 114 edges
3. `createBackend()` - 88 edges
4. `scripts` - 65 edges
5. `callApi()` - 61 edges
6. `WorkId` - 60 edges
7. `@tanstack/react-query` - 59 edges
8. `Tx` - 58 edges
9. `Notice()` - 55 edges
10. `WorkError` - 50 edges

## Surprising Connections (you probably didn't know these)
- `Tx` --references--> `Правила зависимостей`  [INFERRED]
  packages/backend/src/platform/transactions/index.ts → docs/engineering/repository.md
- `createMineruParser()` --references--> `Контракт процессора`  [INFERRED]
  packages/backend/src/modules/documents/infrastructure/mineru.ts → docs/engineering/mineru.md
- `provisionLocalAccess()` --references--> `Повтор команд и журнал действий`  [INFERRED]
  packages/backend/src/modules/access/infrastructure/auth.ts → docs/engineering/backend.md
- `Композиция процесса` --references--> `createBackend()`  [INFERRED]
  docs/adr/0009-backend-architecture.md → packages/backend/src/runtime/create-backend.ts
- `Структура запуска приложений` --references--> `createBackend()`  [INFERRED]
  docs/engineering/repository.md → packages/backend/src/runtime/create-backend.ts

## Import Cycles
- None detected.

## Communities (258 total, 49 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (24): @anyko/contracts, @anyko/document-values, @anyko/logger, @anyko/typescript-config, @base-ui/react, lucide-react, react, @tanstack/react-form (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (32): @anyko/backend, @anyko/contracts, @anyko/database, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (15): hook, root, createLogWriter(), main(), stop(), tee(), parseLaunchArgs(), root (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (50): acceptRunCandidates(), projectRunFacts(), RunProposals, candidateIdentity(), candidatesForContext(), combineCandidates(), ambiguousIncome(), Candidate (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (26): chatProgressKey(), useChatProgress(), useWorkEvents(), WorkLive, endpointUrl(), connectLiveEvents(), eventSchema, parseLiveEvent() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): Зависимости и читаемость, Ответственности и интерфейсы, Ответы модели, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (4): Доказательства, Изменение контроля, Независимое рассмотрение, Поведение и источник требования

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (9): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, 8. Продолжение агентской сессии (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (20): allow_restricted_user(), BasicLimits, command(), create_job(), create_mutex(), ExtendedLimits, initialize_database(), invoke() (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (8): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query(), request()

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (27): WorkNotFound(), DocumentFilters, DocumentOwner, documentResultQueryOptions(), documentSourceQueryOptions(), documentKind(), DocumentOriginal(), documentLinks() (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (25): dependencies, @anyko/backend, @anyko/logger, elysia, zod, devDependencies, @anyko/typescript-config, @types/bun (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (33): dependencies, @anyko/backend, @anyko/llm, @anyko/logger, bullmq, ioredis, zod, devDependencies (+25 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (22): exports, ./base, ./frontend, ./server, eslint, @eslint/js, eslint-plugin-jsx-a11y-x, eslint-plugin-react-hooks (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (65): scripts, access:provision-local, agent:github, api:catalog, artifacts:migrate, boundaries, build, build:windows (+57 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (35): ConnectionErrors, ConnectionsModule, ConnectionsPorts, WorkError, WorkSourceAttachment, WorkSources, changeWork(), finishSourceChange() (+27 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, plugins, types, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (62): previewDocumentValues(), previewStatementValues(), templateData(), Candidates, attachmentCategories, attachmentCopyKind(), attachmentCopyKinds, attachmentDescriptions() (+54 more)

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (8): Границы тестовых сред, Доказательства, Инструменты и обязательность, Как проектировать проверку правила, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (25): 1. State the question, 2. Isolate the logic in a portable module, 3. Build the shareable HTML file, 4. Hand it over, 5. Capture the answer and the prototype, Anti-patterns, Logic Prototype, Process (+17 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (26): KeyedResponse, RouteEnv, Row, AcquireInput, AcquireOutcome, CommandResponse, CreatedResource, IdempotencyKeyRef (+18 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (19): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.05
Nodes (85): AttachmentSuggestion, attachmentSuggestions(), Candidate, courtOptions(), CourtSource, applyRevision(), draftForSave(), FactsDraft (+77 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (12): entry, ignoreDependencies, ignore, ignoreBinaries, entry, ignore, ignoreDependencies, $schema (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.40
Nodes (4): compilerOptions, types, extends, ./base.json

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 36 - "Community 36"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (28): Candidate, supportedQuery(), CreditorLookup, creditorLookupInput, creditorNameKey(), creditorNameSchema, CreditorOrganisation, CreditorQuery (+20 more)

### Community 38 - "Community 38"
Cohesion: 0.05
Nodes (61): WorkPage(), Content, NextStep(), Tone, tones, captionTones, Meta, stepMeta() (+53 more)

### Community 40 - "Community 40"
Cohesion: 0.10
Nodes (13): appdata, bin, data, env, identity, infra, migrator, migratorSource (+5 more)

### Community 41 - "Community 41"
Cohesion: 0.10
Nodes (22): ConnectionHttpOptions, WorkHttpOptions, remove(), Analyze, appWith(), run(), withServer(), memberAccess (+14 more)

### Community 42 - "Community 42"
Cohesion: 0.09
Nodes (23): dependencies, @anyko/contracts, @anyko/document-values, @anyko/logger, @anyko/ui, @base-ui/react, docx-preview, katex (+15 more)

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (19): @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @anyko/typescript-config, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+11 more)

### Community 45 - "Community 45"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 47 - "Community 47"
Cohesion: 0.03
Nodes (64): apps/worker, Как добавлять, Правила, Устройство, claimDocumentAttempt(), documentOcrPolicy, recoverRuns(), BackendConfig (+56 more)

### Community 48 - "Community 48"
Cohesion: 0.06
Nodes (30): dependencies, pg, @prisma/adapter-pg, @prisma/client, @prisma/client-runtime-utils, devDependencies, @anyko/typescript-config, prisma (+22 more)

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (9): build, collectNotices(), components, inputs, noticeIndex, noticeRoot, output, stage (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.08
Nodes (24): dependencies, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+16 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (21): Candidate, ref, runFacts(), AcceptRunCandidatesInput, groupDebtRows(), canApplyCreditorRegistryCandidate(), contractNumber(), creditorIdentifiersConflict() (+13 more)

### Community 52 - "Community 52"
Cohesion: 0.06
Nodes (37): actions, address(), boundedDirectories, collections, declaredOverlaps, entries, Entry, globals (+29 more)

### Community 53 - "Community 53"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sdk/openai-compatible, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native (+13 more)

### Community 54 - "Community 54"
Cohesion: 0.07
Nodes (35): AgentChatMessage, AgentChecklistChange, AgentChecklistWrite, AgentFieldChange, AgentFieldWrite, AgentWriteReceipt, ChatRef, ChatSessionRef (+27 more)

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (27): BodyOf, checkedJson(), createRoute(), FileResult, idempotencyKeyOf(), inputCode(), isFileResult(), ParsedPart (+19 more)

### Community 56 - "Community 56"
Cohesion: 0.05
Nodes (86): deleteDocument(), Контекст, documents, currentConnection(), failed, queued, store(), unused() (+78 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (11): HTTP и `/api/v1`, MinerU и RouterAI: граница совместимости, Вывод, Два разных контракта, Практический вариант для Anyko, Что проверено, Контракт процессора, Локальный stateless MinerU (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.05
Nodes (68): agentHistoryQuery(), agentHistoryRunKey(), analysisRunsQuery(), useRestoreField(), describeFieldRestoreError(), AnalysisJournal(), dateFormat, HistoryRun (+60 more)

### Community 59 - "Community 59"
Cohesion: 0.12
Nodes (15): FactsEditor(), FactsScreen(), fieldNamed(), observations(), pack, personName(), renderFacts(), viewWith() (+7 more)

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/library.json

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 64 - "Community 64"
Cohesion: 0.19
Nodes (9): configure_primary_ocr(), matches_sha256(), model_path(), require_signature(), valid_model(), install(), install_dictionary(), install_weights() (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.07
Nodes (35): bindingKey, block, cell, document, paragraph, row, TemplatePlaceholder, templatePlaceholderSchema (+27 more)

### Community 66 - "Community 66"
Cohesion: 0.06
Nodes (22): works, activeDocument(), attachDocuments(), createWork(), findWork(), listEvents(), listWorks(), notifyDocumentChanged() (+14 more)

### Community 67 - "Community 67"
Cohesion: 0.20
Nodes (7): input, LlmConfiguration, LlmSettingsInput, LlmSettingsStore, revokeConnection(), persistConnection(), saveConnection()

### Community 71 - "Community 71"
Cohesion: 0.13
Nodes (15): devDependencies, @anyko/typescript-config, happy-dom, @happy-dom/global-registrator, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @testing-library/react (+7 more)

### Community 72 - "Community 72"
Cohesion: 0.18
Nodes (21): previewEntries(), CollectionNote(), paperMargins(), paragraphStyle(), signerName(), PreviewPaper(), PreviewTable(), TableBlock (+13 more)

### Community 73 - "Community 73"
Cohesion: 0.13
Nodes (25): "Account", Account_userId_idx, "Membership", Membership_userId_idx, "ProcessingOutbox", ProcessingOutbox_deliveredAt_leaseUntil_idx, ProcessingOutbox_runId_key, ProcessingOutbox_workspaceId_runId_key (+17 more)

### Community 74 - "Community 74"
Cohesion: 0.07
Nodes (43): ConnectionsPage(), clientReady(), emailSchema, passwordSchema, serverReady(), SignIn(), subscribe(), connectionKeys (+35 more)

### Community 75 - "Community 75"
Cohesion: 0.09
Nodes (24): workEventStream(), connections, openEventStream(), workspaceEventStream(), access, member, Receive, ownerOnlyRights (+16 more)

### Community 76 - "Community 76"
Cohesion: 0.09
Nodes (28): lockLiveDocumentForResponse(), lockDocumentRevisions(), createIdempotencyStore(), idempotencyStoreFor(), redactResourceResponses(), workSummarySchema, createChecklistStore(), createWorkDeletionStore() (+20 more)

### Community 77 - "Community 77"
Cohesion: 0.05
Nodes (40): AccessOptions, buildAuth(), grantMembership(), provisionLocalAccess(), createDatabaseEvents(), signalSchema, config, countingSeams() (+32 more)

### Community 78 - "Community 78"
Cohesion: 0.05
Nodes (75): deletionBatches(), readDeletionImpacts(), RecognitionAction, requestBulkDeletion(), requestRetry(), runForDocuments(), useRecognitionAction(), useRetryDocument() (+67 more)

### Community 79 - "Community 79"
Cohesion: 0.32
Nodes (11): assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), commandTimeout(), main(), mintToken(), permissions, readResponse() (+3 more)

### Community 80 - "Community 80"
Cohesion: 0.17
Nodes (10): configured, json(), renderSettings(), serveSaveAnswer(), serveSettings(), sessionWith(), Settings, expectFocused() (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.08
Nodes (19): Files, Implementation vs Review, Reference, Steps, GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.13
Nodes (42): attestedAmount(), attestedDate(), attestedIdentifier(), balanceDates(), businessStatements(), Candidate, checksum(), citationContainsValue() (+34 more)

### Community 83 - "Community 83"
Cohesion: 0.22
Nodes (8): cache, checkModules(), install, modules, output, prepare, prismaCache, root

### Community 84 - "Community 84"
Cohesion: 0.06
Nodes (43): parseBackendEnv(), schema, parseApiConfig(), schema, startApi(), analysisStepwiseSchema, minModelContextSchema, parseBackendEnv() (+35 more)

### Community 85 - "Community 85"
Cohesion: 0.36
Nodes (7): children, command(), launch(), probe(), root, stop(), wait()

### Community 86 - "Community 86"
Cohesion: 0.06
Nodes (31): devDependencies, @anyko/backend, @anyko/contracts, @anyko/database, @anyko/eslint-config, @anyko/llm, @anyko/logger, @anyko/typescript-config (+23 more)

### Community 87 - "Community 87"
Cohesion: 0.16
Nodes (20): WorkspaceLayout(), AppShell(), ShellFrame(), renderShell(), user, session, WorkspaceSwitcher(), createQueryClient() (+12 more)

### Community 88 - "Community 88"
Cohesion: 0.18
Nodes (11): ADR-0008, ADR-0009, workspaceIdSchema, workspaceParams, getLlmSettings, revokeLlmSettings, saveLlmSettings, ADR-0009 (+3 more)

### Community 89 - "Community 89"
Cohesion: 0.22
Nodes (14): invalidReviewValue(), normalizedReviewValue(), reviewCandidateValue(), reviewFields(), ReviewFilter, sameReviewValue(), hasRussianPassportCitizenship(), russianPassportCitation() (+6 more)

### Community 90 - "Community 90"
Cohesion: 0.07
Nodes (25): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record, MISSION.md Format (+17 more)

### Community 91 - "Community 91"
Cohesion: 0.42
Nodes (3): reader(), line(), LogReaderTests

### Community 92 - "Community 92"
Cohesion: 0.17
Nodes (11): listDocumentPackages, documentPackageSchema, documentTemplateSchema, generationFileSchema, packagesResponseSchema, PreviewBlock, previewBlockSchema, previewCellSchema (+3 more)

### Community 93 - "Community 93"
Cohesion: 0.12
Nodes (26): revision(), ChatInput, prepareChatWriter(), queueWrite(), writeChecklist(), writeField(), WriteArgs, WriteChecklist (+18 more)

### Community 94 - "Community 94"
Cohesion: 0.10
Nodes (11): descendant_handles(), initdb_diagnostic(), ModelHandler, start(), main(), port(), ready(), child() (+3 more)

### Community 95 - "Community 95"
Cohesion: 0.09
Nodes (21): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer (+13 more)

### Community 96 - "Community 96"
Cohesion: 0.22
Nodes (7): cache, env, installDir, modelHome, output, pyRelative, rejectLinks()

### Community 97 - "Community 97"
Cohesion: 0.20
Nodes (19): renderWork(), source, result, deletionImpactToken, Status, serveWork(), serveWork(), installEventSource() (+11 more)

### Community 98 - "Community 98"
Cohesion: 0.07
Nodes (44): imageHeaders(), imageIndex(), sourceFileHeaders(), documentRoutes(), presentDocumentResult(), documentSummary(), presentWork(), worksRoutes() (+36 more)

### Community 99 - "Community 99"
Cohesion: 0.10
Nodes (22): bareAmount, cardinal(), currencyInText, denominatedEnd(), Gender, grammar, kopecks, majorAt (+14 more)

### Community 100 - "Community 100"
Cohesion: 0.03
Nodes (46): chatProgressSchema, reconciliationSchema, createAgentChatStore(), createAgentHistoryStore(), agentSessionStoreFor(), Connection, createAgentSessionStore(), createAgentsModule() (+38 more)

### Community 101 - "Community 101"
Cohesion: 0.08
Nodes (41): codes, useGenerateWork(), invalidateWork(), renderCommands(), wrapperFor(), useAnalyzeWork(), useConfirmWork(), recognitionRevisionKey() (+33 more)

### Community 102 - "Community 102"
Cohesion: 0.10
Nodes (30): analysisPolicyRevisionInput(), analysisProposalsSchema(), documentExtractionPolicy(), stepwiseAnalysisInstructions, evidence, modelCandidateSchema(), modelFieldValueInstructions, modelQuoteInstructions (+22 more)

### Community 103 - "Community 103"
Cohesion: 0.05
Nodes (69): Live, WorkHeader(), DocumentSearch(), labels, CatalogView, dateTime, statusText, CurrentCandidateValue() (+61 more)

### Community 104 - "Community 104"
Cohesion: 0.06
Nodes (30): 3. Author the wizard, Доверенный scope и права, Проектирование адресов, DocumentsCommands, DocumentsQueries, FactsCommands, createGeneration(), listGenerations() (+22 more)

### Community 105 - "Community 105"
Cohesion: 0.15
Nodes (13): exports, ./access, ./connections, ./documents, ./errors, ./idempotency, ./ids, ./jobs (+5 more)

### Community 106 - "Community 106"
Cohesion: 0.09
Nodes (56): RecognitionPage(), WorkListPage(), invalidateDocumentCatalog(), unavailableCatalogFiles(), describeDocumentError(), recognitionFailureText(), CatalogSelection(), unavailableReason() (+48 more)

### Community 107 - "Community 107"
Cohesion: 0.09
Nodes (36): WorkspaceActorScope, AnalysisStepInput, DocumentAnalysis, failureOf(), ErrorKind, isAppError(), AnalysisPlan, FieldKey (+28 more)

### Community 108 - "Community 108"
Cohesion: 0.11
Nodes (19): AuditContext, AuditEvent, AuditRecord, AuditTarget, ADR-0009, AuditCommands, AuditConnection, AuditWriter (+11 more)

### Community 109 - "Community 109"
Cohesion: 0.10
Nodes (37): ApiInput, AppOptions, createApp(), registerScopedRoutes(), versionedRoutes(), transportErrorCodes, errorHandling(), statusByKind (+29 more)

### Community 110 - "Community 110"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 111 - "Community 111"
Cohesion: 0.08
Nodes (50): record(), createDocumentCommands(), createDocumentReadModel(), legacyPdf(), view(), RunSummary, SourceSummary, statusSchema (+42 more)

### Community 112 - "Community 112"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 113 - "Community 113"
Cohesion: 0.07
Nodes (28): GET(), HTTP по endpoint-описаниям, Архитектура серверной части: модули, доверенный scope, HTTP по контрактам и реестр заданий, Композиция процесса, Контракты, Модуль: фасад команд и запросов, Отвергнуто, Последствия (+20 more)

### Community 114 - "Community 114"
Cohesion: 0.22
Nodes (9): Архитектура web-приложения: уровни, маршруты рабочей области и общий UI-пакет, Общий UI-пакет, Отвергнуто, Последствия, Проверка сессии на сервере, Рабочая область в адресе, Разделы, Решение (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.17
Nodes (14): addressKey(), addressMentionsTerritory(), cataloguePage, catalogueSchema, contactAddresses(), courtContactUrl(), CourtLookup, courtTerritorySchema (+6 more)

### Community 116 - "Community 116"
Cohesion: 0.08
Nodes (20): This is NOT the Next.js you know, 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система, 6. Типографика и композиция (+12 more)

### Community 117 - "Community 117"
Cohesion: 0.04
Nodes (71): logger, Sent, session, fieldKeySchema, fieldValueSchema, fieldValuesSchema, pageResponseSchema(), agentHistoryEvent (+63 more)

### Community 118 - "Community 118"
Cohesion: 0.14
Nodes (25): "Work", Work_workspaceId_id_key, Work_workspaceId_updatedAt_idx, "WorkAgentThread", WorkAgentThread_workspaceId_workId_idx, "WorkArtifact", WorkArtifact_workspaceId_workId_idx, "WorkEvent" (+17 more)

### Community 119 - "Community 119"
Cohesion: 0.15
Nodes (12): C1, C2, C3, C4, C5, C6, C7, C8 (+4 more)

### Community 121 - "Community 121"
Cohesion: 0.09
Nodes (19): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR, GLOSSARY.md Format, Rules (+11 more)

### Community 122 - "Community 122"
Cohesion: 0.07
Nodes (28): dependencies, lvovich, devDependencies, @anyko/typescript-config, typescript, @typescript/native, exports, ./attachments (+20 more)

### Community 124 - "Community 124"
Cohesion: 0.13
Nodes (15): dependencies, @anyko/database, @anyko/document-values, @anyko/llm, @anyko/logger, @aws-sdk/client-s3, better-auth, @better-auth/prisma-adapter (+7 more)

### Community 125 - "Community 125"
Cohesion: 0.11
Nodes (36): DeepSkyBackdrop(), bandDistance(), Cloud, clouds, createGalaxies(), DeepSky, Field, fit() (+28 more)

### Community 126 - "Community 126"
Cohesion: 0.10
Nodes (18): Call-graph collapse, Candidate card, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Header, HTML Report Format, Mass diagram (good for "interface as wide as implementation") (+10 more)

### Community 127 - "Community 127"
Cohesion: 0.14
Nodes (9): run(), view(), createdWorkView, existingWork, json(), packages, serveWorkList(), template (+1 more)

### Community 128 - "Community 128"
Cohesion: 0.33
Nodes (6): Единая агентская сессия от исходников до чата, Интерфейс сессии, Контекст, стоимость и время, Обращение по шагам, Переход и проверка, Попытки и фиксация

### Community 129 - "Community 129"
Cohesion: 0.19
Nodes (4): graphify, TypeScript 7 и программный API, Версии и совместимость инструментов, Database client generation

### Community 130 - "Community 130"
Cohesion: 0.10
Nodes (16): confirmValues(), editValues(), readAnalysisFacts(), readFacts(), FactEvidence, AnalysisFactsRef, FactsPorts, FactsStore (+8 more)

### Community 131 - "Community 131"
Cohesion: 0.22
Nodes (18): ask(), ask_secret(), banner(), _clear(), _existing(), finish(), note(), open_url() (+10 more)

### Community 132 - "Community 132"
Cohesion: 0.05
Nodes (28): actualPool, agents, apiBackend, availabilityCases, Command, commands, create(), createChatActor() (+20 more)

### Community 133 - "Community 133"
Cohesion: 0.40
Nodes (5): Контекст, Отвергнуто, Последствия, Профили обработки и описания пакетов, Решение

### Community 134 - "Community 134"
Cohesion: 0.12
Nodes (14): Phase boundaries, Primary and secondary sources, The five options, The tree, These are judgement calls, Ask Matt, Codebase health, Context hygiene (+6 more)

### Community 135 - "Community 135"
Cohesion: 0.05
Nodes (37): DocumentAttempt, isActive(), listRuns(), DocumentAttemptStore, DocumentRunOutcome, DocumentRunSnapshot, claimRunAttempt(), RunAttempt (+29 more)

### Community 136 - "Community 136"
Cohesion: 0.13
Nodes (14): Completion criterion: a tight loop that goes red, Diagnosing Bugs, Minimise, Non-deterministic bugs, Phase 1: Build a feedback loop, Phase 2: Reproduce + minimise, Phase 3: Hypothesise, Phase 4: Instrument (+6 more)

### Community 137 - "Community 137"
Cohesion: 0.06
Nodes (33): dependencies, @base-ui/react, lucide-react, @shadcn/react, devDependencies, @anyko/typescript-config, react, @tanstack/react-form (+25 more)

### Community 138 - "Community 138"
Cohesion: 0.40
Nodes (5): Документы и сведения, Заявление о банкротстве, Обработка и подготовка результата, Участники и доступ, Язык Anyko

### Community 139 - "Community 139"
Cohesion: 0.05
Nodes (38): Поток обновлений работы, Полное удаление и восстановление, AgentChatStore, AgentTimelineEntry, ChatDelta, ChatProgress, ChatProgressFeed, ProgressRow (+30 more)

### Community 140 - "Community 140"
Cohesion: 0.18
Nodes (16): attribute(), Cell, cellLines(), fontSize(), padding(), paragraphFonts(), Part, positive() (+8 more)

### Community 141 - "Community 141"
Cohesion: 0.50
Nodes (4): packages/document-values, Как добавлять, Правила, Устройство

### Community 142 - "Community 142"
Cohesion: 0.31
Nodes (8): Anchor, correspondingTop(), Position, positions(), scrollRange(), synchronizeScrolling(), topInViewport(), uniqueAnchors()

### Community 143 - "Community 143"
Cohesion: 0.15
Nodes (10): Designing for Mockability, When to Mock, Anti-patterns, Rules of the loop, Seams: where tests go, Test-Driven Development, What a good test is, Bad Tests (+2 more)

### Community 144 - "Community 144"
Cohesion: 0.50
Nodes (3): Локальная сверка, Приёмочный комплект БФЛ, Сверка с живым провайдером

### Community 145 - "Community 145"
Cohesion: 0.15
Nodes (14): anchorSources, architectureFiles, documents, errors, manifests, markdown, markdownFiles(), packageManifests (+6 more)

### Community 146 - "Community 146"
Cohesion: 0.11
Nodes (37): Candidate, createAnalysisStepAgent(), evidenceBinder(), createChatAgent(), createWorkContextBudget(), fallback, Prompt, createCourtLookupTool() (+29 more)

### Community 147 - "Community 147"
Cohesion: 0.15
Nodes (12): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the tickets to the configured tracker, Acceptance criteria, Blocked by, <NN>: <Ticket title> (+4 more)

### Community 148 - "Community 148"
Cohesion: 0.13
Nodes (8): browserStorageRules, ADR-0009, architectureRules, ioGlobals, restrictedIoGlobals, frontendLibrary, frontendTests, @eslint-community/eslint-plugin-eslint-comments

### Community 149 - "Community 149"
Cohesion: 0.17
Nodes (22): "ProcessingIo", ProcessingIo_workspaceId_documentId_idx, ProcessingIo_workspaceId_requestKey_idx, ProcessingIo_workspaceId_workId_idx, "Run", run_one_active_work, Run_resultKey_key, Run_status_leaseUntil_idx (+14 more)

### Community 150 - "Community 150"
Cohesion: 0.15
Nodes (11): Context pointers, Information hierarchy, Leading words, Invocation, Router skills, Skill mechanics, Splitting by invocation, Pruning (+3 more)

### Community 151 - "Community 151"
Cohesion: 0.29
Nodes (8): Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Explicit scope boundaries, Principles, paint(), schedule(), tick()

### Community 152 - "Community 152"
Cohesion: 0.15
Nodes (11): "SourceDocument", SourceDocument_sourceKey_key, SourceDocument_workspaceId_createdAt_idx, SourceDocument_workspaceId_id_key, SourceDocument_workspaceId_requestKey_key, SourceDocument_deletedAt_purgedAt_idx, SourceDocument_active_filename_trgm_idx, SourceDocument_active_format_page_idx (+3 more)

### Community 155 - "Community 155"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 156 - "Community 156"
Cohesion: 0.08
Nodes (21): DocumentParser, chatModelFetch, completionRequest, userMessage, values, agents, api, config (+13 more)

### Community 159 - "Community 159"
Cohesion: 0.14
Nodes (24): box_coordinates(), comparable_text(), continued_table_pages(), detect_image_boxes(), export_page_evidence(), markdown_row(), markdown_text(), match_scan_blocks() (+16 more)

### Community 161 - "Community 161"
Cohesion: 0.17
Nodes (11): Chart the map, Fog of war, Invocation, Out of scope, Plan, don't do, Refer by name, The Map, The map body (+3 more)

### Community 164 - "Community 164"
Cohesion: 0.16
Nodes (16): "AnykoWorkspace", "DocumentArtifact", DocumentArtifact_manifestKey_position_idx, DocumentArtifact_workspaceId_documentId_idx, DocumentArtifact_workspaceId_requestKey_idx, "DocumentDeletion", DocumentDeletion_workspaceId_requestKey_key, "ProcessorAttempt" (+8 more)

### Community 166 - "Community 166"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 167 - "Community 167"
Cohesion: 0.28
Nodes (4): DiskProjection, HoleFrame, createGalaxyRenderer(), createLensedSky()

### Community 168 - "Community 168"
Cohesion: 0.16
Nodes (13): packages/llm, Как добавлять, Правила, Устройство, catalog, createModelContextLimits(), details, limitsFrom() (+5 more)

### Community 169 - "Community 169"
Cohesion: 0.22
Nodes (9): Invocation, Needs-info template, Quick state override, Reference docs, Resuming a previous session, Roles, Show what needs attention, Triage (+1 more)

### Community 171 - "Community 171"
Cohesion: 0.29
Nodes (4): Directory structure, File format, Out-of-Scope Knowledge Base, Prior requests

### Community 173 - "Community 173"
Cohesion: 0.14
Nodes (8): components, env, metadata, python, pythonRelative, root, source, root

### Community 174 - "Community 174"
Cohesion: 0.50
Nodes (3): extends, include, ../../packages/typescript-config/server.json

### Community 176 - "Community 176"
Cohesion: 0.29
Nodes (7): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Структура запуска приложений, Устройство репозитория

### Community 177 - "Community 177"
Cohesion: 0.67
Nodes (3): packages/typescript-config, Как добавлять, Правила

### Community 178 - "Community 178"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, lib, extends, include, @anyko/typescript-config/library.json

### Community 179 - "Community 179"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/library.json

### Community 181 - "Community 181"
Cohesion: 0.25
Nodes (7): 1. Pin the fixed point, 2. Identify the spec source, 3. Identify the standards sources, 4. Spawn both sub-agents in parallel, 5. Aggregate, Process, Why two axes

### Community 182 - "Community 182"
Cohesion: 0.25
Nodes (7): Anything else?, Context, Document structure, How to answer, <Questionnaire title>, <Theme heading>, What load is the system expected to handle at launch?

### Community 183 - "Community 183"
Cohesion: 0.29
Nodes (7): Bad agent brief, Examples, Good agent brief (bug), Good agent brief (enhancement), Good agent brief (PR), Template, Writing Agent Briefs

### Community 185 - "Community 185"
Cohesion: 0.21
Nodes (9): manrope, metadata, onest, RootLayout(), Providers(), renderWorkspace(), renderWorkList(), ToastProvider() (+1 more)

### Community 186 - "Community 186"
Cohesion: 0.21
Nodes (10): decodeSegment(), GateDecision, GateInput, lastWorkspaceCookie, sessionGate(), plain, secure, config (+2 more)

### Community 187 - "Community 187"
Cohesion: 0.09
Nodes (36): answer(), connectionSchema, LlmErrorCode, llmErrorMessages, modelSchema, ModelSelection, createLocalModelTrace(), ModelTraceContext (+28 more)

### Community 188 - "Community 188"
Cohesion: 0.12
Nodes (17): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels, Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл (+9 more)

### Community 189 - "Community 189"
Cohesion: 0.50
Nodes (4): copyTree(), destination, links, within()

### Community 190 - "Community 190"
Cohesion: 0.08
Nodes (22): member(), Единый механизм запусков, Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Единые таблицы запусков, Отмена, удаление и аудит, Ревизии подключения модели (+14 more)

### Community 191 - "Community 191"
Cohesion: 0.47
Nodes (5): paintBlackHole(), annulus(), disk(), drawSpacecraft(), project()

### Community 193 - "Community 193"
Cohesion: 0.33
Nodes (5): Evidence, Guidance, Merge Danger, Sections, Summary

### Community 194 - "Community 194"
Cohesion: 0.60
Nodes (4): Work_workspaceId_deletedAt_createdAt_id_idx, "WorkDeletion", WorkDeletion_completedAt_failedAt_createdAt_idx, WorkDeletion_workspaceId_completedAt_idx

### Community 198 - "Community 198"
Cohesion: 0.15
Nodes (6): ProcessorReview, fake_parse(), sync_parse(), parse(), parse(), Result

### Community 199 - "Community 199"
Cohesion: 0.13
Nodes (12): image_png(), media_entries(), prepare_docx(), replace_missing_visuals(), primary_image_png(), register_image_format(), save_raster_text(), recognize() (+4 more)

### Community 200 - "Community 200"
Cohesion: 0.08
Nodes (18): pdf, Api, Candidate, delete(), digest(), Fixture, fixtureRoot, fixtures (+10 more)

### Community 201 - "Community 201"
Cohesion: 0.21
Nodes (13): "WorkAgentSession", WorkAgentSession_workspaceId_workId_id_key, WorkAgentSession_workspaceId_workId_key, "WorkAgentTurn", WorkAgentTurn_sessionId_revision_key, WorkAgentTurn_sessionId_runId_key, WorkAgentTurn_workspaceId_workId_idx, "WorkAgentEvent" (+5 more)

### Community 203 - "Community 203"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 204 - "Community 204"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 215 - "Community 215"
Cohesion: 0.27
Nodes (11): anyko_assign_work_event_cursor(), anyko_signal_recognition(), anyko_signal_work_change(), anyko_signal_workspace_change(), recognition_run_signal, recognition_source_signal, work_deletion_signal, work_event_cursor (+3 more)

### Community 216 - "Community 216"
Cohesion: 0.53
Nodes (4): startBlackHole(), paint(), tick(), visibility()

### Community 217 - "Community 217"
Cohesion: 0.13
Nodes (9): Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Работы по шаблону и готовый агентский runtime, Работа по пакету документов, Постоянная сессия работы и отдельные потоки попыток, Выводы агента, продолжение анализа и форматы подстановки, Бланки пакета банкротства (+1 more)

### Community 219 - "Community 219"
Cohesion: 0.05
Nodes (51): RenderBoundary, schema, dispatchOutbox(), reconcileJobs(), startJobWorker(), Фоновые задания, Задания, idempotencyCleanupJob() (+43 more)

### Community 221 - "Community 221"
Cohesion: 0.17
Nodes (12): "WorkDocument", WorkDocument_workspaceId_documentId_key, WorkDocument_workspaceId_workId_idx, "ReadyDocumentRun", WorkDocument_workspaceId_documentId_idx, WorkDocument_workspaceId_workId_uploadGroupId_idx, "WorkUploadGroup", WorkUploadGroup_dispatchedAt_id_idx (+4 more)

### Community 223 - "Community 223"
Cohesion: 0.18
Nodes (9): cyrillicMathMacros, schema, react-dom, react-markdown, rehype-katex, rehype-raw, rehype-sanitize, remark-gfm (+1 more)

### Community 224 - "Community 224"
Cohesion: 0.50
Nodes (4): apps/api, Как добавлять, Правила, Устройство

### Community 225 - "Community 225"
Cohesion: 0.26
Nodes (10): "WorkGeneration", WorkGeneration_key_key, WorkGeneration_workspaceId_workId_createdAt_idx, "DocumentPackageVersion", "DocumentTemplateVersion", "PackageDocument", WorkGeneration_workspaceId_workId_id_packageVersion_key, "WorkGenerationFile" (+2 more)

### Community 227 - "Community 227"
Cohesion: 0.20
Nodes (10): HTTP и данные, Артефакт и изображения, Запуск, Первая вертикаль обработки документов, Проверка, Удаление, canonicalize(), fingerprintInput() (+2 more)

### Community 228 - "Community 228"
Cohesion: 0.50
Nodes (4): packages/contracts, Как добавлять, Правила, Устройство

### Community 229 - "Community 229"
Cohesion: 0.33
Nodes (4): "IdempotencyKey", IdempotencyKey_expiresAt_idx, IdempotencyKey_resource_idx, IdempotencyKey_resource_documents_idx

### Community 231 - "Community 231"
Cohesion: 0.08
Nodes (7): erase(), health(), parse(), parse_source(), prepare_visual_inputs(), OcrStartupReview, RasterRecoveryReview

### Community 233 - "Community 233"
Cohesion: 0.13
Nodes (8): config, assetTypes, bunTestPaths(), flagsWithValues, uncoveredBunTests(), links, marker, [target, link]

### Community 234 - "Community 234"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 235 - "Community 235"
Cohesion: 0.08
Nodes (54): Ошибки, Как добавлять, AgentsModule, AuditModule, ResourceLocks, DocumentsModule, FactsModule, GenerationModule (+46 more)

### Community 237 - "Community 237"
Cohesion: 0.05
Nodes (52): apps/web, Интерфейс, Устройство и правила, dynamic, relay(), WorkspaceLoading(), WorkspaceUnavailable(), RootError() (+44 more)

### Community 238 - "Community 238"
Cohesion: 0.06
Nodes (39): generateDocument(), amountPackage, availablePackages(), bankruptcyPackage, datedPackage, fourthPackage, historicalPackage, isCadastralColumn() (+31 more)

### Community 247 - "Community 247"
Cohesion: 0.40
Nodes (5): devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native

### Community 251 - "Community 251"
Cohesion: 0.33
Nodes (5): 1. Scope the procedure, 2. Map each stage's journey, 4. Verify and hand off, Process, Wizard

### Community 252 - "Community 252"
Cohesion: 0.20
Nodes (10): Заполнение заявления о банкротстве гражданина, Кредиторы и обязательства, Кто определяет состояние, Правила заполнения, Правила заполнения и открытые формулировки, Предлагаемая модель данных, Предлагаемый порядок реализации, Работа, семья, имущество и приложения (+2 more)

### Community 255 - "Community 255"
Cohesion: 0.29
Nodes (4): @playwright/test, ObservedEventSource, required(), signIn()

### Community 257 - "Community 257"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 259 - "Community 259"
Cohesion: 0.09
Nodes (15): { existsSync, readdirSync }, knownModules, moduleEdges, webKnownFeatureViolations, child, metadata, mineru, path (+7 more)

### Community 260 - "Community 260"
Cohesion: 0.40
Nodes (5): API и worker, Backend, Feature-based web и модульный backend с ports/adapters, Web, Последствия

### Community 261 - "Community 261"
Cohesion: 0.13
Nodes (19): LogoLink(), LegacyRecognitionPage(), HomePage(), NoWorkspacePage(), SignInScreen(), SignInPage(), LegacyWorkPage(), SignOut() (+11 more)

### Community 264 - "Community 264"
Cohesion: 0.50
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 265 - "Community 265"
Cohesion: 0.50
Nodes (4): catalog, connections, session, Каталог HTTP API

### Community 267 - "Community 267"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 269 - "Community 269"
Cohesion: 0.50
Nodes (4): packages/backend, Как добавлять, Правила, Устройство

### Community 271 - "Community 271"
Cohesion: 0.50
Nodes (4): packages/database, Как добавлять, Правила, Устройство

### Community 272 - "Community 272"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 274 - "Community 274"
Cohesion: 0.67
Nodes (3): packages/eslint-config, Как добавлять, Правила

### Community 276 - "Community 276"
Cohesion: 0.08
Nodes (30): buildOpenApi(), Json, jsonSchema(), operation(), parameters(), requestBody(), successResponse(), HTTP (+22 more)

## Knowledge Gaps
- **156 isolated node(s):** `@anyko/contracts`, `@anyko/document-values`, `@anyko/logger`, `@anyko/typescript-config`, `@base-ui/react` (+151 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2241 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HTTP` connect `Community 276` to `Community 98`, `Community 227`, `Community 113`, `Community 55`, `Community 91`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `WorkspaceScope` (e.g. with `Доверенный scope и права` and `Последствия`) actually correct?**
  _`WorkspaceScope` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@anyko/contracts`, `@anyko/document-values`, `@anyko/logger` to the rest of the system?**
  _156 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Community 255` to `Community 1`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `AppError` connect `Community 55` to `Community 98`, `Community 66`, `Community 41`, `Community 235`, `Community 75`, `Community 109`, `Community 107`, `Community 276`, `Community 93`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._