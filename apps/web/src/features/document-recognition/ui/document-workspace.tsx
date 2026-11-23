'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { type ComponentProps, useCallback, useState } from 'react';

import { type DocumentSummary, getDocument } from '@anyko/contracts/documents';
import { Button, Notice, Pager, RelativeTime, useToast } from '@anyko/ui';
import { DropZone } from '@anyko/ui/brand';

import { callApi, newIdempotencyKey } from '@/lib/api/call';
import { isUnauthorized } from '@/lib/api/errors';
import { useWorkspaceEvents } from '@/lib/api/live-events';
import { useWorkspaceId } from '@/lib/api/workspace';

import { useUploadDocument } from '../api/commands';
import { type DocumentFilters, documentsQueryOptions } from '../api/queries';
import { describeDocumentError } from '../model/error-texts';

import { DocumentSearch } from './catalog/document-search';
import { useUploadMatchChoice } from './catalog/use-upload-match-choice';
import { DocumentList } from './document-list';
import { useRecognitionFailureToasts } from './use-recognition-failure-toasts';

const accept =
  '.pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,.avif,.heif,.heic,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/tiff,image/avif,image/heif,image/heic';
const emptyDocuments: DocumentSummary[] = [];
type WorkAction = Pick<
  ComponentProps<typeof DocumentList>,
  'AddToWork' | 'onDeletionAccepted'
>;

export function DocumentWorkspace({
  AddToWork,
  onDeletionAccepted,
}: WorkAction) {
  const workspaceId = useWorkspaceId();
  return (
    <WorkspaceDocuments
      key={workspaceId}
      workspaceId={workspaceId}
      AddToWork={AddToWork}
      onDeletionAccepted={onDeletionAccepted}
    />
  );
}

function WorkspaceDocuments({
  workspaceId,
  AddToWork,
  onDeletionAccepted,
}: WorkAction & { workspaceId: string }) {
  useWorkspaceEvents(workspaceId);
  const [filters, setFilters] = useState<DocumentFilters>({
    q: '',
    formats: [],
  });
  const [page, setPage] = useState(1);
  const filtered = !!filters.q || filters.formats.length > 0;
  const list = useQuery(documentsQueryOptions(workspaceId, filters, page));
  const documents = list.data?.items ?? emptyDocuments;
  const deletions = list.data?.pendingDeletions ?? [];
  // Сервер сводит номер за последней страницей к последней, например после удаления файлов.
  const shownPage = (!list.isPlaceholderData && list.data?.page) || page;
  const { track, trackPending, observed } = useRecognitionFailureToasts(
    workspaceId,
    documents,
  );
  const changeFilters = useCallback(
    (next: DocumentFilters) => {
      trackPending(documents);
      setFilters(next);
      setPage(1);
    },
    [documents, trackPending],
  );
  const uploadMutation = useUploadDocument(workspaceId, track);
  const match = useUploadMatchChoice(workspaceId);
  const { add } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const listError =
    list.error && !isUnauthorized(list.error)
      ? describeDocumentError(list.error)
      : '';
  async function upload(files: File[]) {
    const problems: string[] = [];
    let accepted = 0;
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        problems.push(`${file.name}: максимальный размер файла — 20 МБ.`);
        continue;
      }
      if (
        !/\.(pdf|docx|jpe?g|png|webp|tiff?|avif|heif|heic)$/i.test(file.name)
      ) {
        problems.push(
          `${file.name}: поддерживаются PDF, DOCX, JPEG, PNG, WebP, TIFF, AVIF и HEIF/HEIC.`,
        );
        continue;
      }
      // Каждый файл — отдельное действие с собственным ключом идемпотентности.
      try {
        const choice = await match.decide(file);
        if (!choice) continue;
        if (choice.kind === 'reuse') {
          const { document } = await callApi(getDocument, {
            params: { workspaceId, documentId: choice.document.id },
          });
          track(document);
          add({
            variant: 'success',
            title: 'Использован файл из каталога',
            description: document.filename,
          });
          continue;
        }
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
    if (problems.length) {
      add({
        variant: accepted ? 'warning' : 'error',
        mode: 'persistent',
        title: accepted
          ? `На распознавание принято ${String(accepted)} из ${String(files.length)}`
          : 'Не удалось загрузить файлы на распознавание',
        description: problems.join('\n'),
      });
    } else if (accepted) {
      add({
        variant: 'success',
        title: 'Файлы отправлены на распознавание',
        description: `Принято файлов: ${String(accepted)}.`,
      });
    }
    return accepted;
  }
  return (
    <>
      {match.dialog}
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
          hint="PDF, DOCX, JPEG, PNG, WebP, TIFF, AVIF или HEIF/HEIC до 20 МБ. Каждый файл распознаётся отдельно: текст, таблицы, формулы и изображения."
          inputLabel="Файлы для распознавания"
          accept={accept}
          onFiles={upload}
        />
      </div>
      {listError && (
        <div className="mt-6">
          <Notice tone="danger" role="alert" title="Не всё получилось">
            {listError}
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
        onDeletionAccepted={onDeletionAccepted}
        workspaceId={workspaceId}
        documents={documents}
        total={list.data?.total ?? 0}
        observed={observed}
        loading={list.isPending}
        filtered={filtered}
        track={track}
        AddToWork={AddToWork}
        search={<DocumentSearch filters={filters} onChange={changeFilters} />}
        pager={
          list.data && (
            <Pager
              label="Страницы файлов"
              page={shownPage}
              pages={Math.ceil(list.data.total / list.data.pageSize)}
              onPage={(next) => {
                trackPending(documents);
                setPage(next);
              }}
            />
          )
        }
      />
    </>
  );
}
