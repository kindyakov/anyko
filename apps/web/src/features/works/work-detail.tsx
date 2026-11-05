'use client';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { z } from 'zod';
import {
  documentResponseSchema,
  workResponseSchema,
  type FieldValues,
  type WorkView,
} from '@anyko/contracts';
import { ApiError, requestApi } from '../../lib/api/client';
import { SourcePreview } from './source-preview';
import { PackagePreview } from './package-preview';
import { CandidateValue } from './work-fields';
import { UploadFailure, uploadFailureMessage } from './upload-errors';

const accepted = z.object({ status: z.string() });
const statuses: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Готово',
  failed: 'Ошибка',
  partial: 'Частично готово',
  cancelled: 'Остановлено',
  skipped: 'Не требуется',
};
const stages: Record<string, string> = {
  parsing: 'Парсинг и OCR',
  vision: 'Анализ изображений',
  extraction: 'Извлечение фактов',
  reconciliation: 'Сопоставление сведений',
  generation: 'Формирование DOCX',
};
export function WorkDetail({
  workId,
  onUnauthorized,
}: {
  workId: string;
  onUnauthorized: () => void;
}) {
  const [view, setView] = useState<WorkView>();
  const [draft, setDraft] = useState<{
    values: FieldValues;
    revision: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState(false);
  const [streamState, setStreamState] = useState('Подключение событий…');
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const result = await requestApi(`/works/${workId}`, workResponseSchema);
      if (version !== loadVersion.current) return;
      setView(result);
      setLoadError('');
      if (result.cleanupPending) setDraft(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        onUnauthorized();
      else
        setLoadError(
          failure instanceof ApiError && failure.status === 404
            ? 'Работа не найдена.'
            : 'Не удалось обновить работу. Повторите попытку.',
        );
    }
  }, [workId, onUnauthorized]);
  useEffect(() => {
    let active = true;
    let events: EventSource | undefined;
    void requestApi(`/works/${workId}`, workResponseSchema)
      .then((initial) => {
        if (!active) return;
        setView(initial);
        events = new EventSource(
          `/api/works/${workId}/events?after=${initial.cursor}`,
        );
        events.addEventListener('changed', () => {
          void load();
        });
        events.onopen = () => {
          setStreamState('Статусы обновляются автоматически');
          void load();
        };
        events.onerror = () => {
          setStreamState('Переподключаем события. Состояние работы сохранено.');
          void load();
        };
      })
      .catch(() => {
        if (active) void load();
      });
    return () => {
      active = false;
      loadVersion.current++;
      events?.close();
    };
  }, [workId, load]);
  async function command(operation: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await operation();
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        onUnauthorized();
      else
        setError(
          failure instanceof ApiError && failure.code === 'REVISION_CONFLICT'
            ? 'Работа изменилась. Ваши правки сохранены в полях. Обновите основу правок перед повторным сохранением.'
            : failure instanceof UploadFailure
              ? failure.message
              : failure instanceof ApiError
                ? `Операция не выполнена: ${failure.code}`
                : 'Операция не выполнена. Повторите попытку.',
        );
    } finally {
      setPending(false);
    }
  }
  async function upload(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = new FormData(form).getAll('files');
    await command(async () => {
      const failed: string[] = [];
      for (const file of files)
        if (file instanceof File && file.size) {
          const data = new FormData();
          data.set('file', file);
          try {
            await requestApi(
              `/works/${workId}/documents`,
              documentResponseSchema,
              {
                method: 'POST',
                body: data,
                headers: { 'idempotency-key': crypto.randomUUID() },
                timeoutMs: 60000,
              },
            );
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 401)
              throw failure;
            failed.push(uploadFailureMessage(file.name, failure));
          }
        }
      if (failed.length) throw new UploadFailure(failed.join(' '));
      form.reset();
    });
  }
  if (!view)
    return (
      <section className="panel">
        <p role="status">{error || loadError || 'Открываем работу…'}</p>
        <button
          onClick={() => {
            void load();
          }}
        >
          Повторить
        </button>
      </section>
    );
  const busy = pending || view.cleanupPending;
  const active = view.runs.some(
    (run) => run.status === 'queued' || run.status === 'running',
  );
  const values = draft?.values ?? view.facts.values;
  const post = (path: string, value: unknown = {}) =>
    requestApi(`/works/${workId}/${path}`, accepted, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
  return (
    <>
      <Link href="/">← Все работы</Link>
      <h1 className="work-title">{view.work.title}</h1>
      <p className="muted" role="status">
        {streamState}
      </p>
      {(error || loadError) && (
        <div className="error" role="alert">
          {error || loadError}
        </div>
      )}
      {view.cleanupPending && (
        <p className="error" role="status">
          Удаляем данные исходника и производные результаты. Документ временно
          недоступен.
        </p>
      )}
      <section className="panel">
        <h2>Исходные файлы</h2>
        <p className="muted">
          До 20 файлов. Удаление исходника также очищает извлечённые сведения и
          сформированные документы этой работы.
        </p>
        <form
          className="upload-form"
          onSubmit={(event) => {
            void upload(event);
          }}
        >
          <label>
            PDF, DOCX или фотографии
            <input
              name="files"
              type="file"
              multiple
              required
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff"
              disabled={busy || active}
            />
          </label>
          <button disabled={busy || active}>Загрузить</button>
        </form>
        <ul className="document-list">
          {view.documents.map((doc) => (
            <li key={doc.id}>
              <div className="document-name">
                <a
                  href={`/api/documents/${doc.id}/source`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {doc.filename}
                </a>
                <span className={`status status-${doc.status}`}>
                  {statuses[doc.status]}
                </span>
                {doc.status === 'succeeded' && (
                  <SourcePreview
                    key={`${doc.id}-${String(view.work.inputRevision)}`}
                    documentId={doc.id}
                  />
                )}
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  void command(() =>
                    requestApi(
                      `/works/${workId}/documents/${doc.id}`,
                      accepted,
                      {
                        method: 'DELETE',
                      },
                    ),
                  );
                }}
              >
                Удалить полностью
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={busy || active || !view.documents.length}
          onClick={() => {
            void command(() => post('analyze'));
          }}
        >
          {view.runs.length ? 'Повторить обработку' : 'Извлечь сведения'}
        </button>
      </section>
      <section className="panel">
        <h2>Обработка</h2>
        {!view.runs.length && (
          <p className="muted">После загрузки запустите извлечение сведений.</p>
        )}
        {view.runs.slice(0, 5).map((run) => (
          <details
            key={run.id}
            open={
              run.status === 'running' ||
              run.status === 'partial' ||
              run.status === 'failed'
            }
          >
            <summary>
              {run.kind === 'analysis' ? 'Анализ файлов' : 'Создание документа'}{' '}
              · {statuses[run.status]}
            </summary>
            <ul>
              {run.steps.map((step) => (
                <li key={step.id}>
                  {stages[step.stage]}{' '}
                  {step.documentId &&
                    `· ${view.documents.find((doc) => doc.id === step.documentId)?.filename ?? 'исходник'}`}{' '}
                  — {statuses[step.status]}
                  {step.errorCode && ` (${step.errorCode})`}
                  {step.stage === 'vision' &&
                    step.visuals.map((visual) => (
                      <details key={visual.path}>
                        <summary>{visual.path}</summary>
                        {step.documentId && (
                          <a
                            href={`/api/documents/${step.documentId}/source`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Исходный файл
                          </a>
                        )}
                        {step.documentId && visual.imageIndex !== undefined && (
                          <img
                            src={`/api/documents/${step.documentId}/images/${String(visual.imageIndex)}`}
                            alt="Исходное изображение для анализа"
                            loading="lazy"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 360,
                              objectFit: 'contain',
                              display: 'block',
                            }}
                          />
                        )}
                        <p>{visual.description}</p>
                      </details>
                    ))}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
      {draft && (
        <div className="panel">
          <p role="status">
            Есть несохранённые правки. Автоматическое обновление их не меняет.
          </p>
          <div className="work-actions">
            <button
              disabled={busy}
              onClick={() => {
                void command(async () => {
                  await requestApi(
                    `/works/${workId}/fields`,
                    workResponseSchema,
                    {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify(draft),
                    },
                  );
                  setDraft(null);
                });
              }}
            >
              Сохранить поля
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDraft(null);
              }}
            >
              Отменить правки
            </button>
            {draft.revision !== view.work.revision && (
              <button
                className="secondary"
                onClick={() => {
                  setDraft({
                    values: draft.values,
                    revision: view.work.revision,
                  });
                }}
              >
                Применить мои поля к текущей версии
              </button>
            )}
          </div>
        </div>
      )}
      <PackagePreview
        pack={view.package}
        values={values}
        disabled={busy}
        onChange={(key, value) => {
          setDraft({
            revision: draft?.revision ?? view.work.revision,
            values: { ...values, [key]: value },
          });
        }}
      />
      <section className="panel">
        <h2>Извлечённые варианты и источники</h2>
        {!view.facts.candidates.length && (
          <p className="muted">
            После анализа здесь появятся сведения с подтверждающими фрагментами.
          </p>
        )}
        {view.package.fields
          .filter((field) =>
            view.facts.candidates.some(
              (candidate) => candidate.field === field.key,
            ),
          )
          .map((field) => (
            <details className="evidence" key={field.key}>
              <summary>{field.label}</summary>
              {view.facts.candidates
                .filter((candidate) => candidate.field === field.key)
                .map((candidate, index) => (
                  <div key={index}>
                    <CandidateValue value={candidate.value} />
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setDraft({
                          revision: draft?.revision ?? view.work.revision,
                          values: { ...values, [field.key]: candidate.value },
                        });
                      }}
                    >
                      Использовать этот вариант
                    </button>
                    {candidate.evidence.map((source, i) => (
                      <blockquote key={i}>
                        <a
                          href={
                            '/api/documents/' + source.documentId + '/source'
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {view.documents.find(
                            (doc) => doc.id === source.documentId,
                          )?.filename ?? 'Источник'}
                          {source.imagePath && ' · ' + source.imagePath}
                        </a>
                        <p>{source.quote}</p>
                      </blockquote>
                    ))}
                  </div>
                ))}
            </details>
          ))}
      </section>

      <section className="panel">
        <p>
          {view.work.confirmedRevision === view.work.revision
            ? 'Работа подтверждена'
            : 'Сведения требуют вашей проверки'}
        </p>
        <div className="work-actions">
          <button
            disabled={busy || active || !!draft}
            onClick={() => {
              void command(() =>
                requestApi(`/works/${workId}/confirm`, workResponseSchema, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ revision: view.work.revision }),
                }),
              );
            }}
          >
            Подтвердить работу целиком
          </button>
          <button
            className="secondary"
            disabled={busy || active || !!draft}
            onClick={() => {
              void command(() =>
                post('generate', { revision: view.work.revision }),
              );
            }}
          >
            Сформировать комплект DOCX
          </button>
        </div>
        <ul>
          {view.generations.map((generation) => (
            <li key={generation.id}>
              {generation.confirmed ? 'Документ' : 'Черновик'} · версия{' '}
              {generation.revision} · {statuses[generation.status]}{' '}
              <ul>
                {generation.files.map((file) => (
                  <li key={file.id}>
                    {file.title} · {statuses[file.status]}{' '}
                    {file.status === 'succeeded' && (
                      <a
                        href={
                          '/api/works/' +
                          workId +
                          '/generations/' +
                          generation.id +
                          '/files/' +
                          file.id
                        }
                      >
                        Скачать DOCX
                      </a>
                    )}
                    {file.errorCode && (
                      <span role="status">
                        Не удалось сформировать этот документ. Можно создать
                        комплект повторно.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
