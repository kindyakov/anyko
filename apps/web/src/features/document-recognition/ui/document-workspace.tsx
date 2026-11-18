'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button, Notice, RelativeTime } from '@anyko/ui';
import { DropZone } from '@anyko/ui/brand';

import { newIdempotencyKey } from '@/lib/api/call';
import { isUnauthorized } from '@/lib/api/errors';
import { useWorkspaceId } from '@/lib/api/workspace';

import { useUploadDocument } from '../api/commands';
import { documentsQueryOptions } from '../api/queries';
import { describeDocumentError } from '../model/error-texts';

import { DocumentList } from './document-list';

const accept =
  '.pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/tiff';
export function DocumentWorkspace() {
  const workspaceId = useWorkspaceId();
  const list = useInfiniteQuery(documentsQueryOptions(workspaceId));
  const documents = list.data?.pages.flatMap((page) => page.items) ?? [];
  const deletions = list.data?.pages[0]?.pendingDeletions ?? [];
  const uploadMutation = useUploadDocument(workspaceId);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listError =
    list.error && !isUnauthorized(list.error)
      ? describeDocumentError(list.error)
      : '';
  const shownError = error || listError;
  async function upload(files: File[]) {
    setError('');
    const problems: string[] = [];
    let accepted = 0;
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
        accepted++;
      } catch (failure) {
        if (isUnauthorized(failure)) break;
        problems.push(`${file.name}: ${describeDocumentError(failure)}`);
      }
    }
    if (problems.length) setError(problems.join(' '));
    return accepted;
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
          onFiles={upload}
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
      <DocumentList
        key={workspaceId}
        workspaceId={workspaceId}
        documents={documents}
        loading={list.isPending}
      />
      {list.hasNextPage && (
        <Button
          className="mt-4"
          variant="secondary"
          loading={list.isFetchingNextPage}
          disabled={list.isFetching}
          onClick={() => {
            void list.fetchNextPage();
          }}
        >
          Показать ещё
        </Button>
      )}
    </>
  );
}
