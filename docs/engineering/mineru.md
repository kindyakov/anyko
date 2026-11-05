# Локальный MinerU

Для первой вертикали закреплён MinerU **4.1.7**, Python **3.12.15**.
Python-пакеты устанавливаются в `work/mineru/.venv`, конфигурация, модели,
кэш и временные исходники — в `work/mineru/`. Этот каталог исключён из Git.
Документы обрабатываются локальным сервисом; удалённый VLM не настроен,
телеметрия отключена до запуска.

## Установка и запуск на Windows

Из корня репозитория, с установленным uv:

```powershell
powershell -NoProfile -File infra/mineru/setup.ps1
powershell -NoProfile -File infra/mineru/start.ps1
```

Сервис слушает только `http://127.0.0.1:8000`, concurrency 1. По умолчанию
доступны Flash и Basic; Basic выполняет OCR и анализ структуры локальными
ONNX-моделями. Поддержку устройства выбирает MinerU. Первый модельный запуск
загружает веса. На проверенной машине RTX 4060 распознавание и layout используют
DirectML, детектор OCR — CPU. Установленный Python и другие проекты не меняются.

Параметр `-Tier standard` повышает доступный tier и может потребовать другие
модели; качество и ресурсы этого режима пока не проверены. Flash с `ocr_mode=txt`
читает текстовый слой и не доказывает работоспособность OCR сканов.

Проверки сервиса: `GET /v1/health`, `GET /v1/tiers`, определения текущего
контракта — `/openapi.json`. Без API-ключа этот сервис допустим только в
локальной закрытой среде. Его нельзя публиковать в интернет.

## Интерфейс адаптера

`createMineruParser({baseUrl, timeoutMs, tier?, ocrMode?, pollIntervalMs?})`
возвращает `parsePdf(bytes, signal?)`. Результат — Markdown и версия
обработчика. Сценарий документов получает этот интерфейс; HTTP MinerU и ZIP
остаются внутри infrastructure-адаптера.

Используется официальный Tasks API 4.1:

1. JSON `POST /v1/tasks` создаёт один task для одного PDF.
2. Raw bytes отправляются один раз по возвращённому upload URL через PUT.
3. Polling GET проверяет task ID и file ID до конечного состояния.
4. ZIP результата скачивается по result URL; читается только `markdown.md`.

Пределы адаптера: исходник 20 MiB, JSON 1 MiB, ZIP 10 MiB, Markdown 4 MiB,
общий deadline и интервал polling. Возвращённые URL должны находиться в том же
origin и path-prefix; redirects и передача произвольных credentials запрещены.
Ошибки имеют статические коды, provider body в исключения и логи не попадает.
POST создания автоматически не повторяется. Таймаут означает неопределённый
исход внешней операции: работа MinerU может продолжиться; lifecycle и принятие
результата принадлежат сохранённому запуску Anyko.

Tasks MinerU и их индексы находятся в памяти и не гарантируют восстановление
после рестарта. Локальные исходники/результаты удерживаются до 24 часов.
Это временный кэш процессора, не долговременное хранилище Anyko. После приёмки
результат сохраняется владельцем артефакта по правилам приложения.

## Проверки

Unit/HTTP-проверки адаптера выполняются без моделей:

```sh
bun test packages/backend/src/modules/documents/infrastructure/mineru.test.ts
```

Настоящий smoke создаёт только синтетические документы. Для Basic создаётся
PDF из изображения без текстового слоя; Flash получает PDF с текстовым слоем:

```powershell
work/mineru/.venv/Scripts/python.exe infra/mineru/smoke.py --tier flash
work/mineru/.venv/Scripts/python.exe infra/mineru/smoke.py --tier basic --timeout 600
```

5 ноября 2026 оба сценария прошли на MinerU 4.1.7, и TypeScript-адаптер
дополнительно прошёл настоящий Flash round-trip. Изображение распознано с
контрольным маркером `ANYKO`; результаты синтетических smoke сохраняются в
`work/mineru/smoke-*.md`. Это доказывает связь с реальным процессором и работу
OCR, но не качество на клиентском корпусе или production deployment.

Первичные источники: [установка](https://opendatalab.github.io/MinerU/quick_start/),
[Tasks API](https://opendatalab.github.io/MinerU/usage/tasks/),
[модели и конфигурация](https://opendatalab.github.io/MinerU/usage/model_source/).
