'use client';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Form } from '@base-ui/react/form';
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';

import {
  documentResponseSchema,
  documentResultSchema,
  documentsResponseSchema,
  type DocumentSummary,
} from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ResultPreview } from '@/features/documents/result-preview';
import { ApiError, requestApi } from '@/lib/api/client';

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
      <section className="text-muted mt-3 mb-8 max-w-2xl text-sm leading-7">
        <p className="text-muted mb-3 text-[10px] font-semibold tracking-[0.2em]">
          РАБОЧАЯ ОБЛАСТЬ
        </p>
        <h1 className="font-heading mb-3 text-2xl font-semibold tracking-tight">
          Ваши документы
        </h1>
        <p>
          Загрузите документ или фотографию. Мы сохраним оригинал и извлечём
          текст — обработка продолжится, даже если вы закроете страницу.
        </p>
      </section>
      <section className="border-line my-6 rounded-xl border p-5">
        <h2 className="font-heading mb-4 text-lg font-bold">Новый документ</h2>
        <Form
          className="border-line bg-canvas mt-5 flex flex-col gap-5 rounded-xl border border-dashed p-5 sm:flex-row sm:items-end sm:justify-between"
          onSubmit={(event) => {
            void upload(event);
          }}
        >
          <FormField
            className="grid gap-2 text-sm font-medium"
            label={<>PDF, DOCX, JPEG, PNG, WebP или TIFF — до 20 МБ </>}
          >
            <Input
              className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
              ref={fileInput}
              type="file"
              name="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/tiff"
              disabled={uploading}
              required
            />
          </FormField>
          <Button type="submit" disabled={uploading}>
            {uploading ? 'Загружаем…' : 'Загрузить и распознать'}
          </Button>
        </Form>
      </section>
      {error && (
        <p
          className="my-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <section className="border-line my-6 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading mb-4 text-lg font-bold">Документы</h2>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setError('');
              void refresh();
            }}
          >
            Обновить
          </Button>
        </div>
        {!loaded ? (
          <p role="status">Загружаем список…</p>
        ) : documents.length === 0 ? (
          <p className="text-muted text-sm leading-6">
            Здесь появятся ваши документы и результаты распознавания.
          </p>
        ) : (
          <ul className="divide-line mt-5 divide-y [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:gap-4 [&>li]:py-5">
            {documents.map((document) => (
              <li key={document.id}>
                <div className="grid min-w-0 flex-1 gap-2 wrap-anywhere">
                  <strong>{document.filename}</strong>
                  <span className="text-muted text-sm leading-6">
                    {new Date(document.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <span className="border-line bg-canvas text-muted w-fit rounded-full border px-3 py-1 text-xs">
                  {labels[document.status]}
                </span>
                {document.status === 'failed' && (
                  <Button
                    variant="secondary"
                    disabled={pendingId !== undefined}
                    onClick={() => {
                      void retry(document);
                    }}
                  >
                    Повторить
                  </Button>
                )}
                {document.status === 'succeeded' && (
                  <Button
                    variant="secondary"
                    disabled={pendingId !== undefined}
                    onClick={() => {
                      void open(document);
                    }}
                  >
                    {pendingId === document.id
                      ? 'Открываем…'
                      : 'Открыть результат'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={pendingId !== undefined}
                  onClick={() => {
                    setDeleting(document);
                  }}
                  aria-label={`Удалить ${document.filename}`}
                >
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {deletions.length > 0 && (
        <section
          className="border-line my-6 rounded-xl border p-5"
          aria-label="Незавершённые удаления"
        >
          <h2 className="font-heading mb-4 text-lg font-bold">
            Незавершённые удаления
          </h2>
          <p>
            Полное удаление этих файлов ещё не подтверждено. Статус сохранится
            после обновления страницы.
          </p>
          <ul className="divide-line mt-5 divide-y [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:gap-4 [&>li]:py-5">
            {deletions.map((item) => (
              <li key={item.id}>
                <div className="grid min-w-0 flex-1 gap-2 wrap-anywhere">
                  <strong>Удаление {item.id}</strong>
                  <span className="text-muted text-sm leading-6">
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
        <section className="border-line bg-surface [&_pre]:bg-canvas my-6 rounded-2xl border p-5 shadow-sm sm:p-7 [&_pre]:max-h-[650px] [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:p-5 [&_pre]:text-sm [&_pre]:whitespace-pre-wrap">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading mb-4 text-lg font-bold">
                Результат распознавания
              </h2>
              <p className="text-muted text-sm leading-6">{result.filename}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(undefined);
              }}
            >
              Закрыть
            </Button>
          </div>
          <p className="text-muted my-5 text-sm leading-6">
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
        <AlertDialog.Root
          open
          onOpenChange={(open) => {
            if (!open && pendingId === undefined) setDeleting(undefined);
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
            <AlertDialog.Popup
              className="border-line bg-surface text-ink fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-xl"
              aria-label="Удаление документа"
            >
              <AlertDialog.Title className="font-heading mb-4 text-lg font-bold">
                Удалить «{deleting.filename}»?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-muted text-sm leading-6">
                Документ исчезнет из рабочей области. Оригинал и все результаты
                будут удалены без возможности восстановления.
              </AlertDialog.Description>
              <div className="my-5 flex flex-wrap gap-2">
                <Button
                  disabled={pendingId !== undefined}
                  onClick={() => {
                    void remove(deleting);
                  }}
                >
                  {pendingId === deleting.id
                    ? 'Удаляем файлы и результаты…'
                    : 'Удалить документ'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pendingId !== undefined}
                  onClick={() => {
                    setDeleting(undefined);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </>
  );
}
