'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { workSourceLimit } from '@anyko/contracts/works';
import { Button, Input, Modal, Notice } from '@anyko/ui';

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

import { CreateWorkDialog } from './create-work-dialog';

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
  const attached = new Set(work.data?.documents.map(({ id }) => id));
  const newCount = [...selected.keys()].filter(
    (id) => !attached.has(id),
  ).length;
  const tooMany =
    selected.size > workSourceLimit ||
    (newCount > 0 && attached.size + newCount > workSourceLimit);
  const works = list.data?.items ?? [];
  const totalPages = Math.ceil((list.data?.total ?? 0) / 6);

  function submit() {
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
          <>
            <Input
              type="search"
              aria-label="Поиск работы"
              placeholder="Найти работу"
              value={q}
              maxLength={200}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            {list.isPending && (
              <p className="text-muted text-sm" role="status">
                Загружаем работы…
              </p>
            )}
            {list.isError && (
              <Notice tone="danger" role="alert">
                Не удалось загрузить работы.
              </Notice>
            )}
            {list.isSuccess && !works.length && (
              <p className="text-muted text-sm">Работы не найдены.</p>
            )}
            <ul aria-label="Доступные работы" className="grid gap-2">
              {works.map((item) => (
                <li key={item.id}>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={list.isPlaceholderData}
                    onClick={() => {
                      setWorkId(item.id);
                    }}
                  >
                    {item.title}
                  </Button>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
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
          </>
        )}
        {workId && (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm font-medium wrap-anywhere">
              {work.data?.work.title ?? 'Выбранная работа'}
            </p>
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
              disabled={!work.data || !selected.size || tooMany}
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
