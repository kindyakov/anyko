# Размещение основы в Dokploy

Эта инструкция подготовлена для отдельного Linux/systemd-сервера Anyko.
Применение настроек хоста и реальный deployment выполняются отдельно.

## Образы и ресурсы

Из корня репозитория собираются три target одного Dockerfile:

```sh
docker build -f infra/containers/Dockerfile --target api -t anyko-api:COMMIT .
docker build -f infra/containers/Dockerfile --target worker -t anyko-worker:COMMIT .
docker build -f infra/containers/Dockerfile --target web -t anyko-web:COMMIT .
```

Сборка использует закреплённый Bun и frozen lockfile. Runtime работает под
пользователем bun и устанавливает production dependencies workspace; на этом
этапе дерево зависимостей включает все приложения. Сборка образов отдельных
workspace может быть оптимизирована после измерения размера.

`infra/compose/dokploy.yml` — стартовый manifest для Compose-ресурса Dokploy.
Передать ANYKO_WEB_IMAGE, ANYKO_API_IMAGE, ANYKO_WORKER_IMAGE как immutable
registry digest или неизменяемый commit tag и ANYKO_RELEASE. Три процесса
имеют общий release, но отдельные команды и ресурсы. Redis использует свой
volume; удаление volume при обновлении запрещено. В production не публикуется
ни один host port. Документ не предполагает, что Compose обеспечивает atomic
rolling release: порядок совместимых обновлений описан в [operations](operations.md).

В Dokploy добавить маршруты домена: `/api` с более высоким приоритетом ведёт
в `api:3021`, остальные пути — в `web:3020`. Согласовать сохранение или
удаление префикса с реальными API routes до smoke. Dokploy должен подключить
proxy к сети ресурса; доступность проверяется реальным запросом через домен.
Worker probe доступен только во внутренней сети на порту 3022. Проверить
фактические имена переменных по `.env.example` каждого приложения до выпуска.

Для локального Redis, отдельно от production:

```sh
docker compose -f infra/compose/local.yml up -d --wait
```

Он слушает только 127.0.0.1:16399. Тесты используют явный адрес; контейнеры и
volume принадлежат проекту `anyko-foundation-local`. Не применять к ним
глобальные prune-команды и не удалять другие Docker-ресурсы.

## Хранение логов

Manifest включает journald driver только для сервисов Anyko, non-blocking
доставку и ограниченный буфер. Стабильные теги имеют вид
`anyko-production-api`; container ID не является ключом исторического поиска.
Приложение передаёт release в собственные JSON-события.

Пример `infra/diagnostics/60-anyko-journal.conf` устанавливается оператором
в `/etc/systemd/journald.conf.d/60-anyko.conf`. Бюджет 2G и резерв 1G — стартовые
значения для проверки по размеру диска. Настройка относится к системному
журналу выделенного сервера, включая системные события. 14 дней — верхний
целевой срок; размер, резерв и rate limiting могут сократить историю. Ввести
контроль диска и наличия журналов. При отказе хранилища технические события
могут теряться; это не журнал финансового или предметного аудита.

## Ограниченное чтение агентом

Оператор устанавливает `scripts/read-logs.py` как root-owned
`/usr/local/libexec/anyko-read-logs.py`; каталог и файл не доступны на запись
пользователю диагностики. Установить Python 3.10+ и проверить абсолютный путь
`/usr/bin/journalctl`.

Для отдельного пользователя `anyko-logs` добавить узкое sudoers-правило
через `visudo`, проверить синтаксис и владельцев всех родительских каталогов:

```text
anyko-logs ALL=(root) NOPASSWD: /usr/bin/python3 -I /usr/local/libexec/anyko-read-logs.py
```

Его единственный SSH-ключ получает forced command, остальные способы входа
не включаются. Пример записи authorized_keys (подставить публичный ключ):

```text
restrict,command="/usr/bin/sudo -n /usr/bin/python3 -I /usr/local/libexec/anyko-read-logs.py" ssh-ed25519 PUBLIC_KEY
```

Не добавлять пользователя в docker, adm, systemd-journal или sudo. Не выдавать
полный Dokploy API key. Forced command не исполняет переданную клиентом shell
команду. Запрос передаётся как JSON в stdin; клиент должен закрывать stdin
после запроса. Reader ограничивает всё выполнение 25 секундами, включая
ожидание stdin; Linux entry point использует SIGALRM.

Пример stdin:

```json
{"service":"worker","environment":"production","correlationId":"probe-123","limit":200}
```

Разрешены сервисы api, worker, web, redis и среды production, staging. Без
дат берутся последние 30 минут; since/until — ISO timestamp с timezone,
интервал не более суток. Фильтры requestId, correlationId, jobId, release,
event сравниваются буквально. Логи возвращаются от новых к старым; последняя
JSONL-запись summary содержит scanned, returned и truncated. Scope сервиса
проверяется повторно после journalctl. Текстовый crash-вывод имеет parseStatus
text. Oversized или повреждённые записи отмечаются усечением в summary.

Reader ограничивает запрос 8 KiB, число просмотренных строк 5000, ответ 1000
событиями/2 MiB, journal subprocess 15 секундами и 8 MiB временного файла.
Доступная история не обязана содержать каждое событие; усечённую выдачу нельзя
интерпретировать как доказанное отсутствие ошибки. Подтверждения из journald
не заменяют проверки полноты доставки stdout.

## Приёмка на реальном сервере

До объявления release готовым проверить реальные health endpoints, выполнение
задания, reconnect Redis и остановку процессов. Создать событие старого release,
пересоздать контейнер и найти его по service/release; повторить после reboot
хоста. Проверить отказ произвольного SSH-command, PTY, forwarding, чужого scope
и слишком широкого интервала. Проверить поведение при недоступном журнале и
превышении лимитов. Эти действия данным документом не объявлены выполненными.
