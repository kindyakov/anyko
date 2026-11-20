'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search, SearchX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { workSourceLimit } from '@anyko/contracts/works';
import { Button, Input, Modal, Notice } from '@anyko/ui';
import { HorizonLoader } from '@anyko/ui/brand';

import {
  describeDocumentError,
  invalidateDocumentCatalog,
  SelectedCatalogFiles,
  unavailableCatalogFiles,
} from '@/features/document-recognition';
import { useMembership, useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

import { useAttachWorkDocuments } from '../../api/mutations';
import { workQueryOptions, worksQueryOptions } from '../../api/queries';
import { workCommandReasons } from '../../model/command-errors';

import { CreateWorkDialog } from './create-work-dialog';
import { DestinationWorkList } from './destination-work-list';

export function AddRecognitionsToWork({
  selected: initialSelection,
  onClose,
}: {
  selected: ReadonlyMap<string, string>;
  onClose: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { rights } = useMembership();
  const router = useRouter();
  const client = useQueryClient();
  const [selected, setSelected] = useState(() => new Map(initialSelection));
  const [creating, setCreating] = useState(false);
  const [workId, setWorkId] = useState('');
  const [q, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState('');
  const canRead = rights.includes('works.read');
  const list = useQuery({
    ...worksQueryOptions(workspaceId, {
      q: q.trim(),
      page,
      pageSize: 6,
      status: 'all',
    }),
    enabled: canRead && !creating && !workId,
  });
  const work = useQuery({
    ...workQueryOptions(workspaceId, workId),
    enabled: canRead && !!workId && !creating,
  });
  const attach = useAttachWorkDocuments(workspaceId);
  const attachment = work.data?.availability.attach;
  const attached = new Set(work.data?.documents.map(({ id }) => id));
  const newCount = [...selected.keys()].filter(
    (id) => !attached.has(id),
  ).length;
  const tooMany =
    selected.size > workSourceLimit ||
    (newCount > 0 && attached.size + newCount > workSourceLimit);
  const works = list.data?.items ?? [];
  const loadingWorks = list.isPending || list.isPlaceholderData;
  const totalPages = Math.ceil((list.data?.total ?? 0) / 6);

  function submit() {
    if (!attachment?.available || !selected.size || tooMany || attach.isPending)
      return;
    const documentIds = [...selected.keys()];
    setFailure('');
    attach.mutate(
      { workId, documentIds },
      {
        onSuccess: () => {
          onClose();
          router.push(routes.work(workspaceId, workId));
        },
        onError: (error) => {
          const unavailable = unavailableCatalogFiles(
            error,
            documentIds,
            selected,
          );
          if (unavailable) {
            setSelected(unavailable.remaining);
            void invalidateDocumentCatalog(client, workspaceId);
          }
          setFailure(unavailable?.message ?? describeDocumentError(error));
        },
      },
    );
  }

  if (creating)
    return <CreateWorkDialog onClose={onClose} initialSelection={selected} />;

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={!attach.isPending}
      title="Добавить в работу"
      description="Выберите работу для распознанных файлов."
    >
      <div className="grid gap-4">
        {canRead && !workId && (
          <section aria-label="Куда добавить" className="grid gap-2.5">
            <h3 className="text-sm font-semibold">Куда добавить</h3>
            <div className="relative">
              <Search
                size={16}
                aria-hidden
                className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              />
              <Input
                type="search"
                aria-label="Поиск работы"
                placeholder="Найти работу"
                value={q}
                maxLength={200}
                className="pl-9"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            {loadingWorks && <HorizonLoader label="Загружаем работы" />}
            {list.isError && (
              <Notice tone="danger" role="alert">
                Не удалось загрузить работы.
              </Notice>
            )}
            {list.isSuccess && !loadingWorks && !works.length && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <SearchX
                  size={20}
                  aria-hidden
                  className="shrink-0 text-rose-300"
                />
                <div className="min-w-0 flex-1 basis-36" role="status">
                  <p className="text-sm font-semibold">
                    {q.trim() ? 'Работы не найдены' : 'Пока нет работ'}
                  </p>
                  {q.trim() && (
                    <p className="text-muted mt-0.5 text-xs">
                      Попробуйте другое название.
                    </p>
                  )}
                </div>
                {q.trim() && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      setPage(1);
                    }}
                  >
                    Очистить поиск
                  </Button>
                )}
              </div>
            )}
            {!loadingWorks && works.length > 0 && (
              <DestinationWorkList works={works} onSelect={setWorkId} />
            )}
            {!loadingWorks && totalPages > 1 && (
              <nav
                aria-label="Страницы работ"
                className="flex items-center gap-3"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || list.isPlaceholderData}
                  onClick={() => {
                    setPage(page - 1);
                  }}
                >
                  Назад
                </Button>
                <span className="text-muted text-sm" aria-live="polite">
                  Страница {page} из {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || list.isPlaceholderData}
                  onClick={() => {
                    setPage(page + 1);
                  }}
                >
                  Далее
                </Button>
              </nav>
            )}
          </section>
        )}
        {workId && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-400/10 text-rose-300">
              <Check size={17} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted text-xs">Куда добавятся файлы</p>
              <p className="mt-0.5 text-sm font-semibold wrap-anywhere">
                {work.data?.work.title ?? 'Выбранная работа'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={attach.isPending}
              onClick={() => {
                setWorkId('');
                setFailure('');
              }}
            >
              Выбрать другую
            </Button>
          </div>
        )}
        {work.isError && workId && (
          <Notice tone="danger" role="alert">
            Не удалось загрузить выбранную работу.
          </Notice>
        )}
        {workId && work.isPending && (
          <HorizonLoader label="Загружаем выбранную работу" />
        )}
        <SelectedCatalogFiles
          selected={selected}
          attached={attached}
          disabled={attach.isPending}
          onRemove={(id) => {
            setSelected((previous) => {
              const next = new Map(previous);
              next.delete(id);
              return next;
            });
          }}
        />
        {tooMany && (
          <Notice tone="warning">
            В одной работе может быть до {workSourceLimit} файлов. Уменьшите
            выбор или выберите другую работу.
          </Notice>
        )}
        {attachment?.available === false && (
          <Notice tone="warning">
            {workCommandReasons[attachment.reason]}
          </Notice>
        )}
        {failure && (
          <Notice tone="danger" role="alert" title="Не удалось добавить файлы">
            {failure}
          </Notice>
        )}
        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          {rights.includes('works.create') && (
            <Button
              variant="secondary"
              disabled={!selected.size || attach.isPending}
              onClick={() => {
                setCreating(true);
              }}
            >
              Создать новую работу
            </Button>
          )}
          {canRead && (
            <Button
              disabled={!attachment?.available || !selected.size || tooMany}
              loading={attach.isPending}
              onClick={submit}
            >
              Добавить файлы
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
