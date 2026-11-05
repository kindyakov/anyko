# Graph Report - anyko  (2026-11-05)

## Corpus Check
- 66 files · ~66,442 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .pb 3, .ttf 3)

## Summary
- 391 nodes · 390 edges · 44 communities (32 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9694d675`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/package.json
- package.json
- brandbook-03.mjs
- Anyko — брендбук
- MVP: автоматизация подготовки заявления о банкротстве физического лица
- brandbook-01.mjs
- brandbook-04.mjs
- typography-02.mjs
- Архитектура Anyko
- Agent skills
- Issue tracker: GitHub
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
- check-project.mjs
- exports
- web/tsconfig.json
- Данные, доступ и фоновые задания
- Проверка качества
- Размещение и эксплуатация
- Устройство репозитория
- Направления развития Anyko
- Правила написания кода
- knip.json
- server.json
- api/tsconfig.json
- worker/tsconfig.json
- Инженерная основа Anyko
- Работа агентов и независимая проверка
- library.json
- architecture/tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `scripts` - 14 edges
2. `MVP: автоматизация подготовки заявления о банкротстве физического лица` - 14 edges
3. `compilerOptions` - 11 edges
4. `Anyko — брендбук` - 11 edges
5. `compilerOptions` - 9 edges
6. `Архитектура Anyko` - 8 edges
7. `Данные, доступ и фоновые задания` - 7 edges
8. `Проверка качества` - 7 edges
9. `Размещение и эксплуатация` - 6 edges
10. `Устройство репозитория` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (44 total, 12 thin omitted)

### Community 0 - "web/package.json"
Cohesion: 0.07
Nodes (26): dependencies, next, react, react-dom, devDependencies, @anyko/typescript-config, @types/node, @types/react (+18 more)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (27): devDependencies, @anyko/eslint-config, @anyko/prettier-config, dependency-cruiser, eslint, @eslint/js, jscpd, knip (+19 more)

### Community 2 - "brandbook-03.mjs"
Cohesion: 0.09
Nodes (16): inner, page, evidence, files, lum(), page, pairs, src (+8 more)

### Community 3 - "Anyko — брендбук"
Cohesion: 0.12
Nodes (15): 10. Дальнейшее развитие, 1. Основа бренда, 2. Преемственность, 3. Логотип, 4. Маскот, 5. Цветовая система, 6. Типографика и композиция, 7. Голос и тексты (+7 more)

### Community 4 - "MVP: автоматизация подготовки заявления о банкротстве физического лица"
Cohesion: 0.11
Nodes (18): 10. Крупные задачи разработки, 11. Критерии готовности MVP, 12. Что остаётся определить и что отложено, 13. Технические ориентиры, 1. Цель и границы продукта, 2. Принятые решения, 3. Пользовательский сценарий, 4. Архитектура (+10 more)

### Community 8 - "Архитектура Anyko"
Cohesion: 0.25
Nodes (8): 1. Выбранная структура, 2. Компоненты и границы, 3. Поток обработки, 4. Контракты и интеграции, 5. Размещение, 6. Проверка при реализации, 7. Расширение продукта, Архитектура Anyko

### Community 9 - "Agent skills"
Cohesion: 0.40
Nodes (5): Agent skills, Domain docs, Engineering, Issue tracker, Triage labels

### Community 10 - "Issue tracker: GitHub"
Cohesion: 0.40
Nodes (4): Issue tracker: GitHub, Operations, Pull requests as a triage surface, Skill instructions

### Community 11 - "engineering/README.md"
Cohesion: 0.16
Nodes (10): graphify, Один модульный монолит с отдельными процессами, Рабочая область является границей владения данными, PostgreSQL хранит намерение обработки, очередь доставляет работу, Документы и сведения, Обработка и подготовка результата, Участники и доступ, Язык Anyko (+2 more)

### Community 12 - "api/package.json"
Cohesion: 0.10
Nodes (18): dependencies, elysia, devDependencies, @anyko/typescript-config, @types/bun, typescript, @anyko/typescript-config, @types/bun (+10 more)

### Community 15 - "worker/package.json"
Cohesion: 0.13
Nodes (14): devDependencies, @anyko/typescript-config, @types/bun, typescript, @anyko/typescript-config, @types/bun, typescript, name (+6 more)

### Community 16 - "eslint-config/package.json"
Cohesion: 0.13
Nodes (14): exports, ./base, ./frontend, ./server, eslint, @eslint/js, typescript-eslint, name (+6 more)

### Community 17 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, boundaries, build, check:project, dev:api, dev:web, dev:worker, duplicates (+6 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, plugins (+3 more)

### Community 20 - "prettier-config/package.json"
Cohesion: 0.18
Nodes (10): exports, ./backend, ./base, ./frontend, prettier, name, peerDependencies, prettier (+2 more)

### Community 21 - "check-project.mjs"
Cohesion: 0.12
Nodes (9): documents, errors, manifests, markdownFiles(), root, cases, cli, config (+1 more)

### Community 22 - "exports"
Cohesion: 0.25
Nodes (7): exports, ./base.json, ./library.json, ./next.json, ./server.json, name, private

### Community 23 - "web/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, plugins, exclude, extends, include, @anyko/typescript-config/next.json

### Community 24 - "Данные, доступ и фоновые задания"
Cohesion: 0.29
Nodes (7): Владение и изоляция, Данные, доступ и фоновые задания, Доставка и исполнение, Кто владеет данными, Отмена, удаление и аудит, Снимки конфигурации и стоимость, Транзакции и конкурентные правки

### Community 25 - "Проверка качества"
Cohesion: 0.29
Nodes (7): Границы тестовых сред, Доказательства, Инструменты и обязательность, Проверка качества, Проверка самого контроля и исключения, Три уровня проверки, Что тестируем

### Community 26 - "Размещение и эксплуатация"
Cohesion: 0.33
Nodes (6): Восстановление и данные, Начальная топология, Порядок выпуска, Процесс и наблюдаемость, Размещение и эксплуатация, Рост без смены модели

### Community 27 - "Устройство репозитория"
Cohesion: 0.33
Nodes (6): Frontend, Как добавлять новое, Правила зависимостей, Приложения и пакеты, Серверный пакет, Устройство репозитория

### Community 28 - "Направления развития Anyko"
Cohesion: 0.33
Nodes (6): Агентский слой продукта, Когда разделять дальше, Коммерческая модель, Направления развития Anyko, Расширения и точки подключения, Что закладывается в первую реализацию

### Community 30 - "Правила написания кода"
Cohesion: 0.40
Nodes (5): Зависимости и читаемость, Ответственности и интерфейсы, Ошибки и побочные эффекты, Правила написания кода, Типы и границы данных

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

### Community 37 - "Инженерная основа Anyko"
Cohesion: 0.50
Nodes (4): Инженерная основа Anyko, Итог технических дебатов, Карта решений, Порядок первого воплощения

### Community 38 - "Работа агентов и независимая проверка"
Cohesion: 0.50
Nodes (4): Автор изменения, Изменение правил и инструкции, Проверяющий агент, Работа агентов и независимая проверка

### Community 43 - "architecture/tsconfig.json"
Cohesion: 0.50
Nodes (3): ../../packages/typescript-config/server.json, extends, include

## Knowledge Gaps
- **35 isolated node(s):** `@anyko/typescript-config`, `@types/bun`, `typescript`, `@anyko/typescript-config/server.json`, `next` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 300 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MVP: автоматизация подготовки заявления о банкротстве физического лица` connect `MVP: автоматизация подготовки заявления о банкротстве физического лица` to `engineering/README.md`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `@anyko/typescript-config`, `@types/bun`, `typescript` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `Архитектура Anyko` connect `Архитектура Anyko` to `engineering/README.md`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `Данные, доступ и фоновые задания` connect `Данные, доступ и фоновые задания` to `engineering/README.md`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `brandbook-03.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09057971014492754 - nodes in this community are weakly interconnected._