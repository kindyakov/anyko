## Agent skills

### Engineering

При добавлении маршрута, feature, фонового обработчика или серверного модуля применяйте [выбранные архитектурные подходы](docs/adr/0004-code-organization.md): feature-based web; API/worker как адаптеры; модульный backend с ports/adapters. Код сценария принадлежит его владельцу, а не транспорту.

Перед изменением кода прочитайте [карту инженерных правил](docs/engineering/README.md), [структуру и границы](docs/engineering/repository.md), [правила кода](docs/engineering/code-rules.md) и [процесс автора/reviewer](docs/engineering/agent-workflow.md).

При работе с доступом, БД, файлами или очередью читайте [данные и задания](docs/engineering/data-and-jobs.md); с CI/тестами и перед отчётом о готовности — [проверку качества](docs/engineering/quality.md); с контейнерами, миграциями или размещением — [эксплуатацию](docs/engineering/operations.md).

Перед изменением кода приложения или пакета прочитайте его `ARCHITECTURE.md`: назначение, устройство, куда добавлять новое и ссылки на нужные разделы правил.

| Приложения                            | Пакеты                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [api](apps/api/ARCHITECTURE.md)       | [backend](packages/backend/ARCHITECTURE.md), [contracts](packages/contracts/ARCHITECTURE.md), [database](packages/database/ARCHITECTURE.md)                                    |
| [web](apps/web/ARCHITECTURE.md)       | [ui](packages/ui/ARCHITECTURE.md), [document-values](packages/document-values/ARCHITECTURE.md), [llm](packages/llm/ARCHITECTURE.md), [logger](packages/logger/ARCHITECTURE.md) |
| [worker](apps/worker/ARCHITECTURE.md) | [eslint-config](packages/eslint-config/ARCHITECTURE.md), [typescript-config](packages/typescript-config/ARCHITECTURE.md)                                                       |

Команды каркаса и текущие ограничения описаны в [README](README.md); пройденными считаются только фактически выполненные проверки.

При разборе неверного извлечения и изменении промптов, проверки кандидатов или вызовов модели примените [правило ответов модели](docs/engineering/code-rules.md#ответы-модели): сначала класс A/B/C/D по фактическому запросу и ответу, затем исправление только B, C или D. Платный вызов модели — только после согласия пользователя на этот прогон ([процесс автора](docs/engineering/agent-workflow.md#изменение-правил-и-инструкции)).

При добавлении, изменении или удалении тестов применяйте [правила проверки тестов](docs/engineering/test-review.md). При изменении процесса review проверяйте его на [контрольных примерах](docs/engineering/review-cases/README.md).

Перед добавлением или изменением HTTP-запроса сверяйтесь с [каталогом API](docs/engineering/api-catalog.md) и [правилами проектирования адресов](docs/engineering/backend.md#проектирование-адресов).

При диагностике сбоя начните с кода обращения и [серверного журнала](docs/engineering/runtime-foundation.md#события-и-серверный-журнал). Из корня репозитория найдите локальные события, включая ротацию журнала.

```powershell
rtk proxy rg -F "КОД_ОБРАЩЕНИЯ" apps -g "runtime.log*" --hidden --no-ignore
```

В найденном событии ищите `failure.code`, `failure.message`, `failure.operation` и `failure.source`. Повторите поиск по `correlationId`, чтобы проследить запрос через Web, API и worker. Для фонового задания начните с `jobId`.

### Issue tracker

Для агентских команд GitHub и Git push в Anyko используйте `bun run agent:github` по [инструкции доступа](docs/engineering/github-protection.md). При ошибке App не переходите на обычный `gh` или пользовательские credentials. Административные изменения выполняются только по явному поручению пользователя; launcher не изолирует текущую среду от человеческого доступа.

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
