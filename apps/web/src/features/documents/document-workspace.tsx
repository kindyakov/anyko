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

const labels: Record<DocumentSummary['status'], string> = {
  queued: 'В очереди',
  running: 'Распознаётся',
  succeeded: 'Готово',
  failed: 'Не удалось обработать',
};
function message(error: unknown) {
  if (error instanceof ApiError) {
    const text =
      error.code === 'PAYLOAD_TOO_LARGE'
        ? 'Файл слишком большой. Максимум — 20 МБ.'
        : error.code === 'INVALID_PDF'
          ? 'Загрузите корректный PDF-документ.'
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const [result, setResult] = useState<{
    id: string;
    filename: string;
    markdown: string;
    processorVersion: string;
  }>();
  const fileInput = useRef<HTMLInputElement>(null);
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
    if (!processing) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      void refresh(controller.signal);
    }, 2000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [processing, refresh]);
  async function upload(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError('Выберите PDF-документ.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Максимальный размер файла — 20 МБ.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Для распознавания загрузите PDF.');
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
          Загрузите PDF. Мы сохраним оригинал и извлечём текст — обработка
          продолжится, даже если вы закроете страницу.
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
            PDF, до 20 МБ
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept="application/pdf,.pdf"
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
              </li>
            ))}
          </ul>
        )}
      </section>
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
          <pre>{result.markdown || 'В документе не найден текст.'}</pre>
        </section>
      )}
    </>
  );
}
