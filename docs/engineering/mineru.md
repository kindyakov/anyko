# Локальный stateless MinerU

Закреплены MinerU **4.1.7** и Python **3.12.15**. Установка:

```powershell
powershell -NoProfile -File infra/mineru/setup.ps1
powershell -NoProfile -File infra/mineru/start.ps1
```

Сервис слушает `127.0.0.1:8000`. `start.ps1` запускает Anyko-owned HTTP-адаптер
`infra/mineru/processor.py` поверх поддержанного `mineru.parser.parse_async`.
Tasks API, FileStore, document library и их retention-кэш не используются.
В `work/mineru/home` остаются только настройки и веса моделей; телеметрия выключена.

PDF и JPEG/PNG/WebP/TIFF используют Basic с автоматическим OCR. DOCX использует
нативный Flash с текстом, таблицами и формулами Word; OCR вложенных картинок не
обещается. На проверенной машине RTX 4060 ONNX использует DirectML/CPU.
Standard/Advanced и удалённые VLM в этой конфигурации не включены.

## Контракт процессора

- `GET /v1/health`: режим `stateless-sdk`.
- `PUT /v1/attempts/:uuid?format=pdf|docx|jpg|png|webp|tiff`: raw bytes, до 20 MiB;
  ответ ZIP с Markdown и изображениями, заголовок `x-mineru-version`.
- `DELETE /v1/attempts/:uuid`: отменяет попытку, ждёт фактического завершения OCR,
  удаляет временный каталог и только затем возвращает 204. Поздний PUT того же ID
  получает 410. Повторный DELETE идемпотентен.

UUID назначает Anyko и сохраняет в ProcessorAttempt до отправки байтов. Поэтому
таймаут и неизвестный исход HTTP не теряют связь с обрабатываемым исходником.
TypeScript `createMineruParser` предоставляет `parseDocument(bytes,format,attemptId)`
и `eraseAttempt(attemptId)`. Произвольные result/upload URL от провайдера отсутствуют.
Redirect запрещён, ответы ограничены по размеру и deadline, ошибки статические.

Исходник и SDK TEMP/TMP/TMPDIR находятся в одном управляемом каталоге попытки.
Экспорт ZIP собирается в памяти; дополнительные JSON SDK не записываются на диск.
Одновременно выполняется один parse, модели остаются тёплыми. Отмена SDK дренирует
настоящий синхронный OCR thread: закрыть HTTP/asyncio-задачу недостаточно.
При запуске эксклюзивный process lock исключает параллельный сервис, после чего
оставшиеся job-каталоги очищаются до открытия HTTP. Junction/symlink roots отклоняются.
Сохраняются только пустые ID-only cancelled markers, без содержимого документов.

## Хранение и полное удаление

Адаптер извлекает `markdown.md` и проверенные JPEG/PNG/WebP из `images/`.
Ограничения: ZIP 10 MiB, Markdown 4 MiB, 32 картинки, 3 MiB каждая и 8 MiB суммарно;
проверяются объявленный и фактический размер, дубликаты путей, сигнатуры файлов.
Изображения сохраняются отдельными S3-объектами, JSON — только manifest. Правила
владения и подтверждаемого удаления: [вертикаль документов](document-vertical.md).

При переходе со старого Tasks API сначала останавливается старый Anyko-процесс,
проверяется управляемый путь `work/mineru/uploads`, затем его кэш физически
удаляется. Durable-исходники в S3 при этом сохраняются. Старые Base64-результаты
переносятся командой `bun run artifacts:migrate --applications-stopped --storage-requests-drained`
при подтверждённо остановленных API/worker и завершённых storage requests.
Не допускается оставлять старый 24-часовой кэш как исключение из полного удаления.

## Проверка

```sh
bun run test:mineru
bun run test:processor
```

Processor tests используют FastAPI/httpx и настоящий SDK helper отмены без моделей.
Локально команда выбирает подготовленный Python venv. CI устанавливает pinned
MinerU wheel без модельных dependencies и малые зависимости из
`tests/processor/requirements.txt`. Live OCR проверяется отдельно:

```powershell
work/mineru/.venv/Scripts/python.exe infra/mineru/smoke.py --tier basic --format pdf
work/mineru/.venv/Scripts/python.exe infra/mineru/smoke.py --format docx
bun run smoke:document work/mineru/preview.docx
```

В smoke `--tier` управляет видом синтетической PDF-фикстуры (Basic — image-only,
Flash — text layer), а реальный режим процессора выбирается по формату. Никакие
клиентские документы в fixtures не включаются. Синтетический DOCX с таблицей,
картинкой и Word OMML-формулой проверяет связь SDK → S3 → браузер, но не качество
распознавания на реальном корпусе и не production deployment.

Первичный источник: [MinerU](https://github.com/opendatalab/MinerU), публичный Python
SDK и stateless `mineru-kit parse` версии 4.1.7. Кэшируемый `mineru parse` и старый
Tasks/FileStore server для этой схемы не используются.
