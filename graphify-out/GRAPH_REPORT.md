# Graph Report - anyko  (2026-11-05)

## Corpus Check
- 95 files · ~55,176 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 6, .example 3, .pb 3)

## Summary
- 616 nodes · 735 edges · 47 communities (41 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca06bc65`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- agent-github.mjs
- Anyko — брендбук
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- Примеры v1
- Правила написания кода
- pull_request_template.md
- Архитектура Anyko
- Agent skills
- Защита GitHub
- engineering/README.md
- api/package.json
- domain.md
- triage-labels.md
- worker/package.json
- eslint-config/package.json
- scripts
- compilerOptions
- compilerOptions
- prettier-config/package.json
- architecture.js
- exports
- web/tsconfig.json
- read-logs.py
- Проверка качества
- backend/package.json
- Устройство репозитория
- Направления развития Anyko
- logger/package.json
- Данные, доступ и фоновые задания
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- Размещение и эксплуатация
- Runtime и диагностика
- library.json
- worker.integration.test.ts
- Размещение основы в Dokploy
- architecture/tsconfig.json
- Проверка тестов, написанных агентом
- backend/tsconfig.json
- logger/tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `MVP: автоматизация подготовки заявления о банкротстве физического лица` - 14 edges
3. `compilerOptions` - 11 edges
4. `Anyko — брендбук` - 11 edges
5. `createLogger()` - 9 edges
6. `compilerOptions` - 9 edges
7. `Logger` - 8 edges
8. `main()` - 8 edges
9. `LogReaderTests` - 8 edges
10. `Архитектура Anyko` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GitHub App агента` --references--> `check()`  [INFERRED]
  docs/engineering/github-protection.md → tests/architecture/boundaries.test.ts
- `createApp()` --calls--> `createLogger()`  [EXTRACTED]
  apps/api/src/app.ts → packages/logger/src/index.ts

## Import Cycles
- None detected.

## Communities (47 total, 6 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.06
Nodes (33): dependencies, @anyko/logger, next, react, react-dom, server-only, zod, devDependencies (+25 more)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (29): devDependencies, @anyko/eslint-config, @anyko/prettier-config, dependency-cruiser, eslint, @eslint/js, jscpd, knip (+21 more)

### Community 2 - "agent-github.mjs"
Cohesion: 0.07
Nodes (29): { existsSync, readdirSync }, knownModules, moduleEdges, assertNoLocalAuthHeaders(), assertPermissions(), commandEnvironment(), main(), mintToken() (+21 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.12
Nodes (15): 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система, 6. Типографика и композиция, 7. Голос и тексты (+7 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 5 - "Примеры v1"
Cohesion: 0.25
Nodes (8): C1, C2, C3, C4, C5, C6, C7, Примеры v1

### Community 6 - "Правила написания кода"
Cohesion: 0.40
Nodes (5): Зависимости и читаемость, Ответственности и интерфейсы, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

### Community 7 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Доказательства, Изменение контроля, Независимое рассмотрение, Поведение и источник требования

### Community 8 - "Архитектура Anyko"
Cohesion: 0.25
Nodes (8): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, Архитектура Anyko

### Community 9 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 10 - "Защита GitHub"
Cohesion: 0.33
Nodes (6): GitHub App агента, Защита GitHub, Применение и проверка, Разделение полномочий, Состояние настройки, check()

### Community 11 - "engineering/README.md"
Cohesion: 0.06
Nodes (28): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions (+20 more)

### Community 12 - "api/package.json"
Cohesion: 0.08
Nodes (24): dependencies, @anyko/logger, elysia, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript (+16 more)

### Community 15 - "worker/package.json"
Cohesion: 0.08
Nodes (25): dependencies, @anyko/backend, @anyko/logger, zod, devDependencies, @anyko/typescript-config, @types/bun, typescript (+17 more)

### Community 16 - "eslint-config/package.json"
Cohesion: 0.13
Nodes (14): exports, ./base, ./frontend, ./server, eslint, @eslint/js, typescript-eslint, name (+6 more)

### Community 17 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, agent:github, boundaries, build, check:project, dev:api, dev:web, dev:worker (+14 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "prettier-config/package.json"
Cohesion: 0.18
Nodes (10): exports, ./backend, ./base, ./frontend, prettier, name, peerDependencies, prettier (+2 more)

### Community 21 - "architecture.js"
Cohesion: 0.24
Nodes (3): architectureRules, ioGlobals, restrictedIoGlobals

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, plugins, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "read-logs.py"
Cohesion: 0.11
Nodes (9): InvalidQuery, journal_command(), main(), parse_time(), read_journal(), select_events(), validate_query(), line() (+1 more)

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "backend/package.json"
Cohesion: 0.08
Nodes (23): dependencies, @anyko/logger, bullmq, ioredis, zod, devDependencies, @anyko/typescript-config, @types/bun (+15 more)

### Community 27 - "Устройство репозитория"
Cohesion: 0.33
Nodes (6): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Устройство репозитория

### Community 28 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 29 - "logger/package.json"
Cohesion: 0.11
Nodes (18): dependencies, pino, devDependencies, @anyko/typescript-config, @types/bun, typescript, @typescript/native, exports (+10 more)

### Community 30 - "Данные, доступ и фоновые задания"
Cohesion: 0.29
Nodes (7): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки

### Community 31 - "knip.json"
Cohesion: 0.40
Nodes (4): ignore, ignoreBinaries, $schema, workspaces

### Community 33 - "server.json"
Cohesion: 0.40
Nodes (4): compilerOptions, types, extends, ./base.json

### Community 34 - "api/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 36 - "worker/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 37 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 38 - "Runtime и диагностика"
Cohesion: 0.33
Nodes (6): Dokploy и доказательства, Runtime и диагностика, Конфигурация и жизненный цикл, Ответственность, Очередь, События и серверный журнал

### Community 41 - "worker.integration.test.ts"
Cohesion: 0.06
Nodes (22): createApp(), parseApiConfig(), schema, register(), schema, parseWorkerConfig(), schema, resultSchema (+14 more)

### Community 42 - "Размещение основы в Dokploy"
Cohesion: 0.40
Nodes (5): Образы и ресурсы, Ограниченное чтение агентом, Приёмка на реальном сервере, Размещение основы в Dokploy, Хранение логов

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): ../../packages/typescript-config/server.json, extends, include

### Community 44 - "Проверка тестов, написанных агентом"
Cohesion: 0.40
Nodes (5): Глубина проверки по риску, Как доказать способность обнаружить ошибку, Подсказки LLM, Проверка тестов, написанных агентом, Что reviewer устанавливает для каждого изменения

### Community 45 - "backend/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

### Community 46 - "logger/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, @anyko/typescript-config/server.json

## Knowledge Gaps
- **58 isolated node(s):** `@anyko/logger`, `zod`, `@anyko/typescript-config`, `@types/bun`, `typescript` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Защита GitHub` connect `Защита GitHub` to `engineering/README.md`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **What connects `@anyko/logger`, `zod`, `@anyko/typescript-config` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `check()` connect `Защита GitHub` to `agent-github.mjs`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `agent-github.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06914893617021277 - nodes in this community are weakly interconnected._
- **Should `Anyko — брендбук` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._