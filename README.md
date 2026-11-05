# Anyko

Основа приложения для подготовки документов: Next.js, API Elysia и worker BullMQ на Bun. Продуктовый сценарий и границы MVP: [mvp.md](mvp.md). Архитектура и правила разработки: [docs/engineering/README.md](docs/engineering/README.md).

## Разработка каркаса

Для воспроизводимого запуска используются Bun **1.4.4** и Node.js **26.13.0**. Bun — runtime приложений и менеджер workspace; Node используется инструментами, которым он необходим.

```sh
bun install --frozen-lockfile
bun run verify:fast
bun run build
```

`verify:fast` запускает реализованные статические проверки каркаса. Точный состав доступных команд находится в корневом `package.json`; результаты отдельных инструментов следует рассматривать отдельно. Workflow [Scaffold CI](.github/workflows/ci.yml) выполняет эту команду и сборку для каждого push и pull request.

Проверки импортов контролируют циклы, приватные файлы, межмодульный allowlist и прямые обращения к чужому workspace. ESLint ограничивает типичные глобальные источники I/O в domain и profiles. Динамически вычисляемые импорты и доступ к I/O, а также смысловая чистота функций требуют Code review: статический анализ не доказывает их отсутствие. Prettier проверяет файлы каркаса; существующие документы и материалы сторонних навыков в эту область не включены.

`verify:fast` включает unit/HTTP-проверки API, logger, env worker и ограниченного чтения журналов. Интеграция с настоящим Redis выполняется отдельно и включена в CI. Она не подтверждает PostgreSQL, S3, MinerU, LLM, браузерный сценарий или production deployment. Полные `verify`, `verify:release` и `eval:documents` из [политики качества](docs/engineering/quality.md) требуют соответствующих компонентов.

## Запуск и диагностика

Каждое приложение использует собственный `.env` в каталоге приложения; скопируйте соответствующий `.env.example`. Bun загружает его при запуске команды приложения; переменные процесса имеют приоритет. Секреты не нужны для сборки сайта.

```sh
docker compose -p anyko-runtime-test -f infra/compose/local.yml up -d
bun run dev:api
bun run dev:web
```

В env worker задайте `REDIS_URL=redis://127.0.0.1:16379`, затем в отдельном терминале:

```sh
bun run dev:worker
bun --filter @anyko/worker diagnostic
```

API слушает `127.0.0.1:3001`, web — `3000`, внутренние probes worker — `127.0.0.1:3002`. `/health/live` проверяет процесс; `/health/ready` — готовность. Диагностическая очередь не является API предметной обработки.

Локальные команды `dev` и `start` API и worker сохраняют stdout/stderr в
`apps/api/.logs/runtime.log` и `apps/worker/.logs/runtime.log`, одновременно
показывая вывод в терминале. Файлы дописываются после перезапуска; при размере
10 MiB создаются до трёх предыдущих файлов `.1`–`.3`. Каталоги `.logs`
игнорируются Git. Запускайте один локальный процесс каждого приложения:
параллельные launcher одного приложения не делят ротацию безопасно.
Процессы Docker запускаются напрямую и используют серверное хранилище логов.

Интеграционные тесты требуют явного `TEST_REDIS_URL` на изолированный тестовый Redis, например в PowerShell:

```powershell
$env:TEST_REDIS_URL = 'redis://127.0.0.1:16379'
bun run test:worker:integration
```

Приложения пишут JSON в stdout. Для серверного хранения и доступа агента подготовлены [инструкция Dokploy](docs/engineering/deployment.md) и [контракт runtime](docs/engineering/runtime-foundation.md). История journald, SSH-ограничения и сохранение после перезагрузки требуют отдельной проверки на Linux-сервере. На Windows доступ к Docker и HTTP loopback может блокироваться песочницей инструмента: ошибка доступа не означает, что Engine или HTTP-handler сломан.
