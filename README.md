# Anyko

Основа приложения для подготовки документов: Next.js, API Elysia и worker BullMQ на Bun. Продуктовый сценарий и границы MVP: [mvp.md](mvp.md). Архитектура и правила разработки: [docs/engineering/README.md](docs/engineering/README.md).

## Локальная сборка для Windows

На Windows x64 установите Bun 1.4.4, Node.js 26.13.0 и uv 0.13.2, затем в корне репозитория выполните (используется входящая в Windows команда `tar`):

```powershell
bun run build:windows
```

Команда скачивает зависимости и модели, создаёт отдельную папку в `work/windows-builds` и выводит путь к `Anyko-windows-x64.zip`. Для сборки необходимы интернет, свободное место и время на загрузку; пользователю готового архива установка Bun, Node.js или пакетов не нужна. Распакуйте архив и запустите `Anyko.exe`; инструкции и сведения о локальных данных находятся в `Anyko/README.txt`. Облачному AI нужны интернет и настройки провайдера.

Не запускайте одновременно несколько сборок в одном checkout и не меняйте файлы до окончания сборки: локальная команда читает текущую рабочую папку поэтапно. После принудительного завершения процесса, если других сборок нет, удалите оставшийся пустой каталог `work/windows-build.lock` перед повтором.

Workflow [Windows portable build](.github/workflows/windows-components.yml) собирает архив на pull request и вручную, выполняет проверки и сохраняет результат как артефакт на один день. Хранение и время GitHub Actions могут расходовать квоту аккаунта. Локальная команда сборки не заменяет CI-проверки.

После включения workflow в `master` публикация версии выполняется созданием и отправкой тега вида `v1.2.3` или `v1.2.3-preview` на коммит из истории `master`, содержащий этот workflow (обычно на текущий `master`). GitHub Actions заново собирает Windows x64, выполняет проверки и только при успехе публикует архив в GitHub Releases. Версии с суффиксом помечаются как предварительные. Теги выпусков нельзя перемещать или удалять: проверка workflow не устраняет гонку при параллельном изменении тега. Повторная публикация существующей версии не перезаписывает её автоматически; при ошибке проверьте черновик релиза и журнал соответствующего запуска.

Работы по пакетам документов, Mastra/RouterAI, SSE и генерация отдельных DOCX: [устройство и запуск pipeline](docs/engineering/work-pipeline.md). Первый пакет содержит заявление о банкротстве, опись имущества и список кредиторов. [Подготовка бланков с сохранением OOXML](packages/backend/src/modules/templates/assets/README.md).

## Разработка каркаса

Для воспроизводимого запуска используются Bun **1.4.4** и Node.js **26.13.0**. Bun — runtime приложений и менеджер workspace; Node используется инструментами, которым он необходим.

```sh
bun install --frozen-lockfile
bun run verify:fast
bun run build
```

`verify:fast` запускает реализованные статические проверки каркаса. Точный состав доступных команд находится в корневом `package.json`; результаты отдельных инструментов следует рассматривать отдельно. Workflow [Scaffold CI](.github/workflows/ci.yml) выполняет эту команду и сборку для каждого push и pull request.

Проверки импортов контролируют циклы, приватные файлы, межмодульный allowlist и прямые обращения к чужому workspace. ESLint ограничивает типичные глобальные источники I/O в domain и profiles. Динамически вычисляемые импорты и доступ к I/O, а также смысловая чистота функций требуют Code review: статический анализ не доказывает их отсутствие. Bun fmt проверяет файлы каркаса; существующие документы и материалы сторонних навыков в эту область не включены.

`bun run format` форматирует область проверки, `bun run format:check` проверяет её без записи. В `bunfig.toml` включены сортировка импортов, ключей package.json и Tailwind-классов (последняя действует при установленном Tailwind). Исключения файлов заданы там же и в `.gitignore`; для отдельной конструкции доступен комментарий `prettier-ignore`. Локальный pre-commit hook устанавливается командой `bun run hooks:install`: он запускает `bun fmt --staged` для индексированных файлов. При частично индексированном файле Bun откажется менять его, если индексированная версия требует форматирования. Установщик не перезаписывает существующий hook. Hook охватывает индексированные поддерживаемые файлы шире, чем команда проверки каркаса; исключения форматтера действуют и для него.

`verify:fast` включает unit/HTTP-проверки API, logger, env worker и ограниченного чтения журналов. Интеграция с настоящим Redis выполняется отдельно и включена в CI. Она не подтверждает PostgreSQL, S3, MinerU, LLM, браузерный сценарий или production deployment. Полные `verify`, `verify:release` и `eval:documents` из [политики качества](docs/engineering/quality.md) требуют соответствующих компонентов.

## Запуск и диагностика

Обработка PDF, DOCX и фотографий с OCR и единый локальный запуск: [инструкция](docs/engineering/document-vertical.md).
Общая локальная конфигурация теперь хранится в игнорируемом корневом `.env` по
`.env.example`; app-specific `.env` может дополнять её. Для запуска используйте
`bun run dev`. Для свежего checkout перед отдельными quality-командами выполните
`bun run db:generate`.

Локальные launcher API и worker загружают корневой `.env` и, при наличии, `.env` приложения. Команды `dev`, `build` и `start` web и диагностическая команда worker также загружают корневой `.env`. Переменные процесса имеют приоритет. Секреты не нужны для сборки сайта. Следующие команды позволяют запускать процессы отдельно; для полной PDF/OCR-вертикали используйте `bun run dev` и инструкцию выше.

```sh
docker compose --env-file .env -p anyko-runtime-test -f infra/compose/local.yml -f infra/compose/storage.yml up -d
bun run storage:prepare
bun run dev:api
bun run dev:web
```

В env worker задайте `REDIS_URL=redis://127.0.0.1:16399`, затем в отдельном терминале:

```sh
bun run dev:worker
bun --filter @anyko/worker diagnostic
```

Локальный `bun run dev` использует настройки корневого `.env`. Сайт: `http://anyko.localhost:3020`; API слушает `127.0.0.1:3021`, web — `3020`, внутренние probes worker — `127.0.0.1:3022`. `/health/live` проверяет процесс; `/health/ready` — готовность. Диагностическая очередь не является API предметной обработки.

Локальные команды `dev` и `start` Web, API и worker сохраняют структурированные
события в `apps/<app>/.logs/runtime.log`. В терминале виден и вывод фреймворка.
В интерактивном терминале JSON-события отображаются в читаемом виде с цветом
уровня; `NO_COLOR` отключает цвет. При перенаправлении stdout остаётся JSON.
Файлы дописываются после перезапуска; при размере
10 MiB создаются до трёх предыдущих файлов `.1`–`.3`. Каталоги `.logs`
игнорируются Git. Запускайте один локальный процесс каждого приложения:
параллельные launcher одного приложения не делят ротацию безопасно.
Процессы Docker запускаются напрямую и используют серверное хранилище логов.

Интеграционные тесты требуют явного `TEST_REDIS_URL` на изолированный тестовый Redis, например в PowerShell:

```powershell
$env:TEST_REDIS_URL = 'redis://127.0.0.1:16399'
bun run test:worker:integration
```

Для сквозных web-тестов доступны `bun run e2e:prepare` и `bun run e2e:backend`.
Сначала создайте отдельную базу PostgreSQL с именем, оканчивающимся на `_e2e`, и
задайте `E2E_DATABASE_URL`, `E2E_REDIS_URL`, `E2E_OWNER_EMAIL`/`E2E_OWNER_PASSWORD`,
`E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD`, `E2E_OUTSIDER_EMAIL`/`E2E_OUTSIDER_PASSWORD`,
`AUTH_SECRET`, `AUTH_BASE_URL`, `APP_ORIGIN` и `LLM_CONFIG_ENCRYPTION_KEY`. Для web
используйте origin `http://127.0.0.1:3030`, для API — `AUTH_BASE_URL=http://127.0.0.1:3031`
и `API_PORT=3031`. Пароли должны содержать не менее 12 символов, адреса пользователей
должны различаться. Не используйте настоящие учётные данные.

`e2e:prepare` **сбрасывает схему public указанной базы**, применяет миграции,
создаёт пользователей и области `e2e-north` и `e2e-south`, очищает только очереди
`anyko-e2e-document` и `anyko-e2e-work`. Остановите предыдущий E2E backend перед
подготовкой. `e2e:backend` запускает API и worker в одном процессе с общим хранилищем
в памяти и заглушками OCR и модели; его данные файлов теряются при остановке.
Задержка задаётся `E2E_PROCESSING_DELAY_MS` (по умолчанию 300 мс). Фикстура
с именем `fail.pdf` заглушка возвращает ошибку; остальные допустимые файлы, включая
`tests/e2e/fixtures/source.pdf`, проходят распознавание. Для проверки окружения выполните
`bun run test:e2e:config` и `bun run test:e2e:integration`: второй тест повторно
сбрасывает указанную E2E-базу и запускает API на `API_PORT`.

Для браузерных сценариев установите Node версии из `.node-version`, выполните
`node node_modules/@playwright/test/cli.js install chromium`, затем
`bun run test:e2e`. Команда собирает web из текущих исходников, повторно готовит
и очищает указанную E2E-базу и очереди, затем запускает backend и свежую
production-сборку web на портах 3031 и 3030. Эти порты должны быть свободны.
`bun run verify` включает браузерные сценарии наряду с остальными проверками.

Приложения пишут JSON в stdout. Для серверного хранения и доступа агента подготовлены [инструкция Dokploy](docs/engineering/deployment.md) и [контракт runtime](docs/engineering/runtime-foundation.md). История journald, SSH-ограничения и сохранение после перезагрузки требуют отдельной проверки на Linux-сервере. На Windows доступ к Docker и HTTP loopback может блокироваться песочницей инструмента: ошибка доступа не означает, что Engine или HTTP-handler сломан.

Локальные порты Anyko: сайт3020, API3021, worker3022, MinerU8020, Redis16399, S319020. Общий PostgreSQL остаётся на5432; его данные и настройки не меняются.

Worker workload selection: `WORKER_QUEUES=ocr,llm,render,maintenance` (all by default).
Unknown or empty names fail startup; selecting `ocr` leaves `llm` and `render` for other processes.
The separate diagnostic `QUEUE_NAME` is always enabled, including empty mode.
`bun run test:worker:integration` runs diagnostic and business queue integration tests with
`TEST_DATABASE_URL` and `TEST_REDIS_URL`; E2E uses its own `anyko-e2e` BullMQ prefix.
See [queue rollout and scaling](docs/engineering/operations.md#выкат-заданий-и-очередей).
`platform/realtime` remains deferred to the agent chat work and is not implemented by #21.
