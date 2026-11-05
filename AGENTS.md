## Agent skills

### Engineering

Перед изменением кода прочитайте [карту инженерных правил](docs/engineering/README.md), [структуру и границы](docs/engineering/repository.md), [правила кода](docs/engineering/code-rules.md) и [процесс автора/reviewer](docs/engineering/agent-workflow.md).

При работе с доступом, БД, файлами или очередью читайте [данные и задания](docs/engineering/data-and-jobs.md); с CI/тестами и перед отчётом о готовности — [проверку качества](docs/engineering/quality.md); с контейнерами, миграциями или размещением — [эксплуатацию](docs/engineering/operations.md).

Команды каркаса и текущие ограничения описаны в [README](README.md); пройденными считаются только фактически выполненные проверки. Новые локальные AGENTS добавляются вместе с реальными приложениями и содержат только их особенности.

При добавлении, изменении или удалении тестов применяйте [правила проверки тестов](docs/engineering/test-review.md). При изменении процесса review проверяйте его на [контрольных примерах](docs/engineering/review-cases/README.md).

### Issue tracker

Задачи и спецификации ведутся в GitHub Issues репозитория kindyakov/anyko. См. `docs/agents/issue-tracker.md`.

### Triage labels

Используются стандартные метки triage. См. `docs/agents/triage-labels.md`.

### Domain docs

Единый контекст: корневой глоссарий и `docs/adr/`. См. `docs/agents/domain.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
