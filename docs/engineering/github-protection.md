# Защита GitHub

## Состояние настройки

Включено 5 ноября 2026: `kindyakov/anyko`, основная ветка `master`, репозиторий публичный после самостоятельного переключения пользователем. Создан [ruleset 26578732](https://github.com/kindyakov/anyko/rules/26578732), enforcement `active`. Повторное чтение ruleset и эффективных правил `master` подтвердило настройки; `current_user_can_bypass` — `never`. Первоначальное ограничение тарифа приватного репозитория устранено сменой публичности пользователем.

[Payload ruleset](github-ruleset.json) подготовлен для default branch: только PR, одно одобрение, сброс прежнего одобрения после изменения, одобрение последнего push другим участником, закрытые обсуждения, запрет force push и удаления. Bypass-список пуст. Требуется актуальность относительно целевой ветки и проверка `Scaffold checks (static and build)` от GitHub Actions, integration ID 15368.

GitHub также включил дополнительное одобрение для неатрибутированных изменений Copilot; этот параметр сохранён в payload. Code-owner review не включён: файла CODEOWNERS и отдельной модели владельцев пока нет. Проверка CI и одобрение обязательны для всех изменений, включая workflow и настройки контроля.

Имя и app ID прочитаны из реального check run для commit `6b6c76a54abefe2a96efb567162d19b668f9a0e2`, результат `success`. Это не проверка незакоммиченного локального дерева. Workflow выполняет `verify:fast` и сборку. Default workflow token имеет `read`; создание одобряющих PR reviews через Actions отключено. Эти настройки уже действовали до настройки защиты.

## Разделение полномочий

Обычный CLI авторизован как `kindyakov`, администратор и единственный участник. GitHub не различает человека и агента под одной учётной записью. Пустой bypass-список не запрещает администратору отредактировать или удалить ruleset. Для агентских команд настроено отдельное приложение, описанное ниже.

Для защищённого процесса агент работает через отдельный GitHub App installation token или отдельную учётную запись: достаточно прав на код/ветки и PR, без Administration, управления правилами и bypass. У человека остаются административная учётная запись и одобрение PR. Административные credentials нельзя оставлять доступными среде агента. Не выдавать агенту право записи checks/statuses без необходимости; required check привязан к GitHub Actions, но reviewer всё равно проверяет изменения самого workflow и скриптов.

Автор PR не может засчитать своё одобрение. Агент открывает PR как `anyko-coding-agent[bot]`, человек `kindyakov` проверяет и одобряет. Приложение не добавлено в bypass. Разделение идентичностей не делает review автоматически независимым: агент не должен использовать человеческую авторизацию для одобрения.

## GitHub App агента

Создано и установлено 5 ноября 2026: [Anyko Coding Agent](https://github.com/settings/apps/anyko-coding-agent), App ID `5620461`, [installation `178751173`](https://github.com/settings/installations/178751173). Установка доступна только аккаунту владельца; выбрано `Only select repositories` → **только `kindyakov/anyko`**. Старые `anyko_client`, `anyko_server` и другие проекты не включены. Общая авторизация `gh`, Git credentials и настройки остальных проектов не менялись.

| Разрешение | Уровень |
| --- | --- |
| Contents, Pull requests | Read and write |
| Actions, Checks, Issues, Metadata | Read |
| Administration, Workflows, Secrets, Commit statuses, остальные права | Нет |

OAuth от имени пользователя, device flow и webhook выключены. Приложение не может менять ruleset или записывать результат required check. Изменения `.github/workflows` публикует человек: права Workflows у приложения нет. Contents write позволяет merge при соблюдении правил ветки; это не запрет на любой merge после человеческого одобрения.

Приватный ключ хранится вне checkout: `%LOCALAPPDATA%\Anyko\agent-auth\github-app.pem`. Для самого файла ключа установлена и проверена ACL: наследование отключено, доступ только текущему Windows-пользователю. Это ограничение для других пользователей ОС, **не изоляция от агента под тем же пользователем**. Ключ не добавляется в `.env`, Git, CI или чат. Client secret не создавался.

Для команд агента из корня Anyko:

```powershell
$env:ANYKO_GITHUB_APP_KEY_PATH = Join-Path $env:LOCALAPPDATA 'Anyko\agent-auth\github-app.pem'
rtk proxy bun run agent:github check
rtk proxy bun run agent:github gh pr list
rtk proxy bun run agent:github git ls-remote https://github.com/kindyakov/anyko.git HEAD
```

[Обвязка](../../scripts/agent-github.mjs) проверяет App/installation и набор прав, выдаёт токен только для Anyko, проверяет список доступных репозиториев и отзывает токен после команды. Токен передаётся дочернему процессу через environment, без записи в Git config или аргументы процесса. Для `gh` создаётся временный пустой config; `gh auth` отключён. Для Git отключены глобальная/системная конфигурация и credential helpers, разрешён HTTPS. Глобальные настройки пользователя не переписываются. Команда ограничена пятью минутами; запрос к GitHub — 15 секундами. При невозможности получить токен выполнение завершается ошибкой, без перехода на пользовательский `gh`.

Если локальная или worktree-конфигурация Git содержит `http.*.extraHeader` или `http.extraHeader`, launcher отказывается запускать Git и gh до получения токена. Это защищает от смешивания с заголовком другой авторизации; не удаляйте чужую настройку автоматически. Перенаправление Git в другой каталог/конфиг через `-C`, `--git-dir`, `--work-tree`, `-c` в launcher запрещено. Git author — метаданные коммита; полномочия push определяются токеном приложения.

**Граница защиты:** по решению пользователя изоляция среды отложена. Этот launcher выбирает credentials для дочерней команды; он не является sandbox. Текущий desktop-агент по-прежнему может вызвать обычный `gh` или воспользоваться доступным браузером/коннектором. Запрет на доступ к админским credentials будет обеспечен только отдельной средой агента без пользовательского профиля, SSH agent, браузерной сессии, административного коннектора и доступа к host credential store. Не объявлять эту часть завершённой.

Live-проверка `check` подтвердила один репозиторий у токена и HTTP `403` от `GET /repos/kindyakov/anyko/actions/permissions`, требующего Administration. Это безопасная проверка отказа чтения административной настройки, а не попытка изменить защиту ветки. Запрет записи правил дополнительно следует из отсутствия Administration. Проверка реального PR/merge остаётся отдельной приёмкой.

Также прошли `gh api` через launcher и Git `push --dry-run` на URL с `.git`; dry-run не создавал ветку. Отсутствующий ключ завершает launcher с exit 1 до запуска `gh`. [Регрессионные проверки](../../tests/tooling/agent-github.test.mjs) через настоящий Git проверяют выбор заголовка для обоих URL Anyko и отсутствие заголовка для чужого репозитория/хоста; команда `test:agent-github` включена в `verify:fast`. Это проверка маршрутизации credentials, не доказательство sandbox или успешного реального merge.

Отзыв доступа: владелец открывает installation и выбирает Suspend/Uninstall; ключи удаляет в Credentials приложения. Изменение прав требует явного решения владельца. Обычный срок жизни installation token — один час; launcher отзывает его раньше, если завершается штатно. При аварийном завершении процесса токен может действовать до истечения срока. [Документация GitHub о токенах установки](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).

## Применение и проверка

Защита уже активна. Перед дальнейшим изменением перечитать существующий ruleset и сохранить не относящиеся к задаче требования. Для адресного обновления из корня репозитория:

```powershell
rtk proxy gh api --method PUT repos/kindyakov/anyko/rulesets/26578732 --input docs/engineering/github-ruleset.json
```

Проверить ответ, затем получить созданный ruleset по его ID и эффективные правила `repos/kindyakov/anyko/rules/branches/master`. Зафиксировать ссылку, ID и действующие параметры в этом документе. Убедиться, что required check совпадает с реальным job. Редактирование уже существующего ruleset выполняется адресно, сохраняя не относящиеся к задаче требования.

Поведенческая приёмка — на следующем настоящем PR отдельной агентской идентичности: до CI и одобрения merge запрещён; после нового push прежнее одобрение не подходит. Успешное чтение конфигурации не выдаётся за этот тест. Не проверять запрет разрушительным force push или удалением основной ветки.

Источник условий тарифов и прав: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [REST API rules](https://docs.github.com/en/rest/repos/rules).
