'use client';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type DocumentSummary } from '@anyko/contracts/documents';

import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { DropZone } from '@/components/ui/drop-zone';
import { FileIcon } from '@/components/ui/file-icon';
import { HoverMist } from '@/components/ui/hover-mist';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { stagger } from '@/components/ui/stagger';
import { Notice, StatusPill, type Tone } from '@/components/ui/status';
import {
  DocumentViewer,
  type ViewedDocument,
} from '@/features/document-recognition/document-viewer';
import { newIdempotencyKey } from '@/lib/api/call';
import {
  ApiError,
  describeApiError,
  isUnauthorized,
  sharedCodeTexts,
} from '@/lib/api/errors';
import { useWorkspaceId } from '@/lib/api/workspace';

import {
  useDeleteDocument,
  useRetryDocument,
  useUploadDocument,
} from './api/commands';
import { documentsQueryOptions } from './api/queries';

const accept =
  '.pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/tiff';
const labels: Record<DocumentSummary['status'], string> = {
  queued: 'В очереди',
  running: 'Распознаётся',
  succeeded: 'Распознан',
  failed: 'Не удалось обработать',
};
const tones: Record<DocumentSummary['status'], Tone> = {
  queued: 'neutral',
  running: 'progress',
  succeeded: 'success',
  failed: 'danger',
};
const documentTexts = {
  codes: {
    ...sharedCodeTexts,
    DELETION_PENDING:
      'Удаление ещё выполняется. Файлы пока не считаются удалёнными; повторите проверку позже.',
    DELETION_NEEDS_RECOVERY:
      'Удаление требует восстановления незавершённой записи в хранилище. Статус «удалено» ещё не подтверждён.',
    PAYLOAD_TOO_LARGE: 'Файл слишком большой. Максимум — 20 МБ.',
    INVALID_DOCUMENT:
      'Не удалось прочитать файл. Проверьте, что его содержимое соответствует формату PDF, DOCX или изображения.',
    UNSUPPORTED_DOCUMENT_FORMAT:
      'Поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.',
    REQUEST_TIMEOUT:
      'Сервер не ответил вовремя. Обновите список перед повторной загрузкой.',
  },
  technical: 'Не удалось выполнить действие. Попробуйте ещё раз.',
  fallback: 'Не удалось выполнить действие. Попробуйте ещё раз.',
};
function message(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось выполнить действие.';
  const text = describeApiError(error, documentTexts);
  return error.requestId ? `${text} Код обращения: ${error.requestId}` : text;
}
export function DocumentWorkspace() {
  const workspaceId = useWorkspaceId();
  const list = useQuery(documentsQueryOptions(workspaceId));
  const documents = list.data?.documents ?? [];
  const deletions = list.data?.deletions ?? [];
  const uploadMutation = useUploadDocument(workspaceId);
  const retryMutation = useRetryDocument(workspaceId);
  const deleteMutation = useDeleteDocument(workspaceId);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<ViewedDocument>();
  const [deleting, setDeleting] = useState<DocumentSummary>();
  const pendingId = retryMutation.isPending
    ? retryMutation.variables
    : deleteMutation.isPending
      ? deleteMutation.variables
      : undefined;
  const listError =
    list.error && !isUnauthorized(list.error) ? message(list.error) : '';
  const shownError = error || listError;
  // Сессия истекла: ошибка не показывается, оболочка перенаправит на вход.
  function fail(failure: unknown) {
    if (isUnauthorized(failure)) return;
    setError(message(failure));
  }
  const processing = documents.filter(
    (document) => document.status === 'queued' || document.status === 'running',
  ).length;
  async function upload(files: File[]) {
    if (uploading) return;
    setError('');
    setUploading(true);
    const problems: string[] = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        problems.push(`${file.name}: максимальный размер файла — 20 МБ.`);
        continue;
      }
      if (!/\.(pdf|docx|jpe?g|png|webp|tiff?)$/i.test(file.name)) {
        problems.push(
          `${file.name}: поддерживаются PDF, DOCX, JPEG, PNG, WebP и TIFF.`,
        );
        continue;
      }
      // Каждый файл — отдельное действие с собственным ключом идемпотентности.
      try {
        await uploadMutation.mutateAsync({
          file,
          idempotencyKey: newIdempotencyKey(),
        });
      } catch (failure) {
        if (isUnauthorized(failure)) break;
        problems.push(`${file.name}: ${message(failure)}`);
      }
    }
    setUploading(false);
    if (problems.length) setError(problems.join(' '));
  }
  function retry(document: DocumentSummary) {
    setError('');
    retryMutation.mutate(document.id, { onError: fail });
  }
  function removeDocument(document: DocumentSummary) {
    setError('');
    setViewing((current) =>
      current?.id === document.id ? undefined : current,
    );
    deleteMutation.mutate(document.id, {
      onSuccess: () => {
        setDeleting(undefined);
      },
      onError: fail,
    });
  }
  return (
    <>
      <header className="animate-rise mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Распознавание
          </h1>
          <p className="text-muted mt-3 max-w-2xl leading-7">
            Получите текст из скана, фото или DOCX без создания работы. Оригинал
            сохраняется, а обработка продолжится, даже если закрыть страницу.
          </p>
        </div>
        <Button
          variant="secondary"
          loading={refreshing}
          onClick={() => {
            setError('');
            setRefreshing(true);
            void list.refetch().finally(() => {
              setRefreshing(false);
            });
          }}
        >
          <RefreshCw size={16} />
          Обновить
        </Button>
      </header>
      <div className="animate-rise [animation-delay:60ms]">
        <DropZone
          title="Отправьте файлы в Anyko"
          hint="PDF, DOCX, JPEG, PNG, WebP или TIFF до 20 МБ. Каждый файл распознаётся отдельно: текст, таблицы, формулы и изображения."
          inputLabel="Файлы для распознавания"
          accept={accept}
          busy={uploading}
          onFiles={(files) => {
            void upload(files);
          }}
        />
      </div>
      {shownError && (
        <div className="mt-6">
          <Notice tone="danger" role="alert" title="Не всё получилось">
            {shownError}
          </Notice>
        </div>
      )}
      {deletions.length > 0 && (
        <section
          className="mt-6 grid gap-2"
          aria-label="Незавершённые удаления"
        >
          {deletions.map((item) => (
            <Notice
              key={item.id}
              tone={item.status === 'needs-recovery' ? 'warning' : 'progress'}
              role="status"
              title={
                item.status === 'needs-recovery'
                  ? 'Удаление требует восстановления — файлы ещё не удалены'
                  : 'Удаляем файлы и результаты'
              }
            >
              Полное удаление ещё не подтверждено. Статус сохранится после
              обновления страницы. Начато{' '}
              <RelativeTime value={item.createdAt} />.
            </Notice>
          ))}
        </section>
      )}
      <section className="mt-10" aria-labelledby="documents-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="documents-title"
            className="font-heading text-xl font-bold tracking-tight"
          >
            Файлы
            {documents.length > 0 && (
              <span className="text-muted ml-2 text-base font-medium">
                {documents.length}
              </span>
            )}
          </h2>
          {processing > 0 && (
            <StatusPill tone="progress">Распознаётся: {processing}</StatusPill>
          )}
        </div>
        {list.isPending ? (
          <ul className="grid gap-3" aria-busy aria-label="Файлы загружаются">
            {[0, 1, 2].map((item) => (
              <li
                key={item}
                className="glass flex items-center gap-4 rounded-2xl border border-white/[0.06] p-4"
              >
                <Skeleton className="size-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-2 h-3 w-1/5" />
                </div>
                <Skeleton className="h-9 w-28 rounded-lg" />
              </li>
            ))}
          </ul>
        ) : documents.length === 0 ? (
          <p className="glass text-muted rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm">
            Здесь появятся загруженные файлы и результаты распознавания.
          </p>
        ) : (
          <ul className="grid gap-3">
            {documents.map((document, index) => {
              const busy =
                document.status === 'queued' || document.status === 'running';
              return (
                <li
                  key={document.id}
                  className={`animate-rise glass group/mist relative isolate flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.07] p-4 transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/30 hover:shadow-[0_16px_50px_-24px_#db143c88] sm:flex-nowrap ${stagger(index)}`}
                >
                  {busy && (
                    <span
                      aria-hidden
                      className="animate-flow absolute inset-x-0 bottom-0 h-0.5 bg-[repeating-linear-gradient(90deg,#db143c_0_14px,transparent_14px_28px)]"
                    />
                  )}
                  <HoverMist />
                  <FileIcon filename={document.filename} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium wrap-anywhere">
                      {document.filename}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      Загружен <RelativeTime value={document.createdAt} />
                    </p>
                  </div>
                  <StatusPill tone={tones[document.status]}>
                    {labels[document.status]}
                  </StatusPill>
                  <div className="flex gap-2">
                    {document.status === 'failed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={
                          retryMutation.isPending &&
                          retryMutation.variables === document.id
                        }
                        disabled={pendingId !== undefined}
                        onClick={() => {
                          retry(document);
                        }}
                      >
                        <RotateCw size={15} />
                        Повторить
                      </Button>
                    )}
                    {document.status === 'succeeded' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setViewing({
                            id: document.id,
                            filename: document.filename,
                            owner: { kind: 'recognition' },
                          });
                        }}
                      >
                        <Eye size={15} />
                        Открыть
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pendingId !== undefined}
                      onClick={() => {
                        setDeleting(document);
                      }}
                      aria-label={`Удалить ${document.filename}`}
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <DocumentViewer
        document={viewing}
        onClose={() => {
          setViewing(undefined);
        }}
      />
      <Confirm
        open={!!deleting}
        title={`Удалить «${deleting?.filename ?? ''}»?`}
        confirmLabel="Удалить документ"
        pending={pendingId !== undefined}
        onConfirm={() => {
          if (deleting) removeDocument(deleting);
        }}
        onCancel={() => {
          setDeleting(undefined);
        }}
      >
        Документ исчезнет из рабочей области. Оригинал и все результаты будут
        удалены без возможности восстановления.
      </Confirm>
    </>
  );
}
