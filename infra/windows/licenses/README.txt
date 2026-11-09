Состав и лицензии сторонних компонентов

Архив содержит стороннее ПО с собственными условиями распространения. Тексты
лицензий Bun, Redis, сборки Redis для Windows и RustFS находятся рядом с этим
файлом. Redis доступен по нескольким лицензиям; применимые условия необходимо
выбрать и проверить до распространения. Файлы bun.lock и requirements-windows.lock
фиксируют версии JavaScript- и Python-зависимостей, включая транзитивные.

PostgreSQL 18.6: https://www.postgresql.org/about/licence/
Дистрибутив EnterpriseDB содержит infrastructure/postgresql/pgsql/server_license.txt.
Redis 8.10.3: https://github.com/redis/redis/tree/8.10.3
Сборка для Windows: https://github.com/redis-windows/redis-windows/tree/8.10.3
RustFS 1.0.1: https://github.com/rustfs/rustfs/tree/1.0.1
Bun 1.4.4: https://github.com/oven-sh/bun/tree/bun-v1.4.4
MinerU: https://github.com/opendatalab/MinerU
Модели: https://huggingface.co/opendatalab/MinerU-4_models_onnx/tree/358310b4f64b95f9fefc372ad899356e4111f376
Тексты лицензий Python-пакетов находятся в соответствующих каталогах
mineru/python-dist/*/Lib/site-packages/*.dist-info, а информация о моделях —
в mineru/home. Исходники других зависимостей определяются по lock-файлам.

Наличие этого списка не заменяет проверки условий распространения всех
транзитивных зависимостей и моделей для выбранного способа распространения.
