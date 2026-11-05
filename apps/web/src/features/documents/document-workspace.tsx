'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  documentResponseSchema,
  documentsResponseSchema,
  documentResultSchema,
  type DocumentSummary,
} from '@anyko/contracts';
import { ApiError, requestApi } from '../../lib/api/client';
import { ResultPreview } from './result-preview';
import { z } from 'zod';

const labels: Record<DocumentSummary['status'], string> = {
  queued: 'В очереди',
  running: 'Распознаётся',
  succeeded: 'Готово',
  failed: 'Не удалось обработать',
};
function message(error: unknown) {
  if (error instanceof ApiError) {
    const text =
      error.code === 'DELETION_PENDING'
        ? 'Удаление ещё выполняется. Файлы пока не считаются удалёнными; повторите проверку позже.'
        : error.code === 'DELETION_NEEDS_RECOVERY'
          ? 'Удаление требует восстановления незавершённой записи в хранилище. Статус «удалено» ещё не подтверждён.'
          : error.code === 'PAYLOAD_TOO_LARGE'
            ? 'Файл слишком большой. Максимум — 20 МБ.'
            : error.code === 'INVALID_DOCUMENT'
              ? 'Не удалось прочитать файл. Проверьте, что его содержимое соответствует формату PDF, DOCX или изображения.'
              : error.code === 'UNSUPPORTED_DOCUMENT_FORMAT'
                ? 'Поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.'
                : error.code === 'REQUEST_TIMEOUT'
                  ? 'Сервер не ответил вовремя. Обновите список перед повторной загрузкой.'
                  : 'Не удалось выполнить действие. Попробуйте ещё раз.';
    return error.requestId ? `${text} Код обращения: ${error.requestId}` : text;
  }
  return 'Не удалось выполнить действие.';
}
export function DocumentWorkspace({
  onUnauthorized,
}: {
  onUnauthorized: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [deletions, setDeletions] = useState<
    z.infer<typeof documentsResponseSchema>['deletions']
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const [result, setResult] = useState<{
    id: string;
    filename: string;
    markdown: string;
    processorVersion: string;
    images: { path: string; url: string }[];
  }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<DocumentSummary>();
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleting && deleteDialog.current && !deleteDialog.current.open)
      deleteDialog.current.showModal();
  }, [deleting]);
  const alive = useRef(true);
  const handleError = useCallback(
    (failure: unknown) => {
      if (!alive.current) return;
      if (failure instanceof ApiError && failure.status === 401) {
        onUnauthorized();
        return;
      }
      setError(message(failure));
    },
    [onUnauthorized],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await requestApi(
          '/documents',
          documentsResponseSchema,
          signal ? { signal } : {},
        );
        if (!signal?.aborted && alive.current) {
          setDocuments(response.documents);
          setDeletions(response.deletions);
          setLoaded(true);
        }
      } catch (failure) {
        if (!signal?.aborted) {
          setLoaded(true);
          handleError(failure);
        }
      }
    },
    [handleError],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [refresh]);
  const processing = documents.some(
    (document) => document.status === 'queued' || document.status === 'running',
  );
  useEffect(() => {
    if (!processing && deletions.length === 0) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      void refresh(controller.signal);
    }, 2000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [processing, deletions.length, refresh]);
  async function upload(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError('Выберите документ или фотографию.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Максимальный размер файла — 20 МБ.');
      return;
    }
    if (!/\.(pdf|docx|jpe?g|png|webp|tiff?)$/i.test(file.name)) {
      setError('Поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.');
      return;
    }
    setError('');
    setUploading(true);
    const body = new FormData();
    body.set('file', file);
    try {
      const response = await requestApi('/documents', documentResponseSchema, {
        method: 'POST',
        body,
        headers: { 'idempotency-key': crypto.randomUUID() },
      });
      if (alive.current) {
        setDocuments((items) => [
          response.document,
          ...items.filter((item) => item.id !== response.document.id),
        ]);
        setLoaded(true);
        if (fileInput.current) fileInput.current.value = '';
      }
    } catch (failure) {
      handleError(failure);
    } finally {
      if (alive.current) setUploading(false);
    }
  }
  async function retry(document: DocumentSummary) {
    setPendingId(document.id);
    setError('');
    try {
      const response = await requestApi(
        `/documents/${encodeURIComponent(document.id)}/retry`,
        documentResponseSchema,
        { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } },
      );
      if (alive.current)
        setDocuments((items) =>
          items.map((item) =>
            item.id === document.id ? response.document : item,
          ),
        );
    } catch (failure) {
      handleError(failure);
    } finally {
      if (alive.current) setPendingId(undefined);
    }
  }
  async function remove(document: DocumentSummary) {
    setPendingId(document.id);
    setError('');
    try {
      await requestApi(
        `/documents/${encodeURIComponent(document.id)}`,
        z.object({ status: z.literal('deleting') }),
        { method: 'DELETE' },
      );
      await refresh();
      if (alive.current)
        setResult((current) =>
          current?.id === document.id ? undefined : current,
        );
      let complete = false;
      const deadline = Date.now() + 120000;
      while (alive.current && Date.now() < deadline) {
        const progress = await requestApi(
          `/documents/${encodeURIComponent(document.id)}/deletion`,
          z.object({
            status: z.enum(['deleting', 'deleted', 'needs-recovery']),
          }),
        );
        if (progress.status === 'needs-recovery')
          throw new ApiError('DELETION_NEEDS_RECOVERY', 409, '');
        if (progress.status === 'deleted') {
          complete = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!complete) throw new ApiError('DELETION_PENDING', 202, '');
      if (alive.current) {
        setDocuments((items) =>
          items.filter((item) => item.id !== document.id),
        );
        setResult((current) =>
          current?.id === document.id ? undefined : current,
        );
        setDeleting(undefined);
        await refresh();
      }
    } catch (failure) {
      handleError(failure);
    } finally {
      if (alive.current) setPendingId(undefined);
    }
  }
  async function open(document: DocumentSummary) {
    setPendingId(document.id);
    setError('');
    try {
      const response = await requestApi(
        `/documents/${encodeURIComponent(document.id)}/result`,
        documentResultSchema,
      );
      if (alive.current)
        setResult({
          id: document.id,
          filename: document.filename,
          ...response,
        });
    } catch (failure) {
      handleError(failure);
    } finally {
      if (alive.current) setPendingId(undefined);
    }
  }
  return (
    <>
      <section className="intro">
        <p className="eyebrow">РАБОЧАЯ ОБЛАСТЬ</p>
        <h1>Ваши документы</h1>
        <p>
          Загрузите документ или фотографию. Мы сохраним оригинал и извлечём
          текст — обработка продолжится, даже если вы закроете страницу.
        </p>
      </section>
      <section className="panel">
        <h2>Новый документ</h2>
        <form
          className="upload-form"
          onSubmit={(event) => {
            void upload(event);
          }}
        >
          <label>
            PDF, DOCX, JPEG, PNG, WebP или TIFF — до 20 МБ
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/tiff"
              disabled={uploading}
              required
            />
          </label>
          <button type="submit" disabled={uploading}>
            {uploading ? 'Загружаем…' : 'Загрузить и распознать'}
          </button>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Документы</h2>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setError('');
              void refresh();
            }}
          >
            Обновить
          </button>
        </div>
        {!loaded ? (
          <p role="status">Загружаем список…</p>
        ) : documents.length === 0 ? (
          <p className="muted">
            Здесь появятся ваши документы и результаты распознавания.
          </p>
        ) : (
          <ul className="document-list">
            {documents.map((document) => (
              <li key={document.id}>
                <div className="document-name">
                  <strong>{document.filename}</strong>
                  <span className="muted">
                    {new Date(document.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <span className={`status status-${document.status}`}>
                  {labels[document.status]}
                </span>
                {document.status === 'failed' && (
                  <button
                    className="secondary"
                    disabled={pendingId !== undefined}
                    onClick={() => {
                      void retry(document);
                    }}
                  >
                    Повторить
                  </button>
                )}
                {document.status === 'succeeded' && (
                  <button
                    className="secondary"
                    disabled={pendingId !== undefined}
                    onClick={() => {
                      void open(document);
                    }}
                  >
                    {pendingId === document.id
                      ? 'Открываем…'
                      : 'Открыть результат'}
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={pendingId !== undefined}
                  onClick={() => {
                    setDeleting(document);
                  }}
                  aria-label={`Удалить ${document.filename}`}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {deletions.length > 0 && (
        <section className="panel" aria-label="Незавершённые удаления">
          <h2>Незавершённые удаления</h2>
          <p>
            Полное удаление этих файлов ещё не подтверждено. Статус сохранится
            после обновления страницы.
          </p>
          <ul className="document-list">
            {deletions.map((item) => (
              <li key={item.id}>
                <div className="document-name">
                  <strong>Удаление {item.id}</strong>
                  <span className="muted">
                    {new Date(item.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <span role="status">
                  {item.status === 'needs-recovery'
                    ? 'Требует восстановления — файлы ещё не удалены'
                    : 'Удаляем файлы и результаты…'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result && (
        <section className="panel result">
          <div className="section-heading">
            <div>
              <h2>Результат распознавания</h2>
              <p className="muted">{result.filename}</p>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setResult(undefined);
              }}
            >
              Закрыть
            </button>
          </div>
          <p className="result-note">
            Автоматически извлечённый текст. Перед использованием проверьте его
            по исходному документу.
          </p>
          <ResultPreview
            key={result.id}
            markdown={result.markdown}
            images={result.images}
          />
        </section>
      )}
      {deleting && (
        <dialog
          ref={deleteDialog}
          className="panel"
          role="alertdialog"
          aria-label="Удаление документа"
          aria-describedby="deletion-description"
          onCancel={(event) => {
            if (pendingId !== undefined) {
              event.preventDefault();
              return;
            }
            setDeleting(undefined);
          }}
        >
          <h2>Удалить «{deleting.filename}»?</h2>
          <p id="deletion-description">
            Документ исчезнет из рабочей области. Оригинал и все результаты
            будут удалены без возможности восстановления.
          </p>
          <div className="result-toolbar">
            <button
              disabled={pendingId !== undefined}
              onClick={() => {
                void remove(deleting);
              }}
            >
              {pendingId === deleting.id
                ? 'Удаляем файлы и результаты…'
                : 'Удалить документ'}
            </button>
            <button
              className="secondary"
              disabled={pendingId !== undefined}
              onClick={() => {
                setDeleting(undefined);
              }}
            >
              Отмена
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
