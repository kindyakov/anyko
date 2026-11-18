import { RotateCw, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { Button, Confirm, Skeleton, StatusPill, useToast } from '@anyko/ui';

import { isUnauthorized } from '@/lib/api/errors';

import { useRecognitionAction } from '../api/commands';
import {
  describeDocumentError,
  recognitionRetryCode,
} from '../model/error-texts';

import { DocumentRow, SelectionCheckbox } from './document-row';
import { DocumentViewer, type ViewedDocument } from './document-viewer';

export function DocumentList({
  workspaceId,
  documents,
  loading,
}: {
  workspaceId: string;
  documents: DocumentSummary[];
  loading: boolean;
}) {
  const mutation = useRecognitionAction(workspaceId);
  const selectAllId = useId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [viewing, setViewing] = useState<ViewedDocument>();
  const [deleting, setDeleting] = useState<DocumentSummary[]>([]);
  const { add } = useToast();
  const selected = documents.filter((document) => selectedIds.has(document.id));
  const retryable = selected.filter((document) => document.status === 'failed');
  const allSelected =
    selected.length > 0 && selected.length === documents.length;
  const pending = mutation.isPending ? mutation.variables : undefined;
  const processing = documents.filter(
    (document) => document.status === 'queued' || document.status === 'running',
  ).length;

  function changeSelection(id: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(
    kind: 'retry' | 'delete',
    targets: DocumentSummary[],
    bulk = false,
  ) {
    if (pending || targets.length === 0) return;
    const documentIds = targets.map((document) => document.id);
    if (kind === 'delete') {
      setViewing((current) =>
        current && documentIds.includes(current.id) ? undefined : current,
      );
    }
    mutation.mutate(
      { kind, documentIds, bulk },
      {
        onSuccess: ({ succeeded, failed }) => {
          setSelectedIds((previous) => {
            const next = new Set(previous);
            for (const id of succeeded) next.delete(id);
            return next;
          });
          const names = new Map(
            targets.map(({ id, filename }) => [id, filename]),
          );
          const count = `${String(succeeded.length)} из ${String(targets.length)}`;
          const title =
            kind === 'retry'
              ? succeeded.length
                ? `Повторное распознавание запущено: ${count}`
                : 'Не удалось повторить распознавание'
              : succeeded.length
                ? `Удалено: ${count}`
                : 'Не удалось удалить файлы';
          const description = failed.length
            ? failed
                .map(
                  ({ id, error }) =>
                    `${names.get(id) ?? id}: ${describeDocumentError(error)}`,
                )
                .join('\n')
            : targets.map(({ filename }) => filename).join('\n');
          add({
            title,
            description,
            variant: failed.length
              ? succeeded.length
                ? 'warning'
                : 'error'
              : 'success',
            mode: failed.length ? 'persistent' : 'timed',
          });
        },
        onError: (error) => {
          if (!isUnauthorized(error))
            add({
              variant: 'error',
              mode: 'persistent',
              title:
                kind === 'retry'
                  ? 'Не удалось повторить распознавание'
                  : 'Не удалось удалить файлы',
              description: describeDocumentError(error),
            });
        },
        onSettled: () => {
          setDeleting([]);
        },
      },
    );
  }

  function retry(documentId: string) {
    const document = documents.find((item) => item.id === documentId);
    if (document?.status === 'failed') run('retry', [document]);
  }

  return (
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
      {documents.length > 0 && (
        <div className="glass mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 px-4 py-2">
          <label
            htmlFor={selectAllId}
            className="flex items-center gap-2 text-sm"
          >
            <SelectionCheckbox
              id={selectAllId}
              label="Выбрать все файлы"
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              disabled={!!pending}
              onCheckedChange={(checked) => {
                setSelectedIds(
                  new Set(checked ? documents.map(({ id }) => id) : []),
                );
              }}
            />
            Все файлы
          </label>
          {selected.length > 0 && (
            <>
              <span className="text-muted text-sm" role="status">
                Выбрано: {selected.length}
              </span>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!!pending || retryable.length === 0}
                  loading={pending?.kind === 'retry' && pending.bulk}
                  onClick={() => {
                    run('retry', retryable, true);
                  }}
                >
                  <RotateCw size={15} />
                  Повторить распознавание
                  {retryable.length > 0 ? ` (${String(retryable.length)})` : ''}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!!pending}
                  onClick={() => {
                    setDeleting(selected);
                  }}
                >
                  <Trash2 size={15} />
                  Удалить выбранные
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {loading ? (
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
        <ul className="grid gap-3" aria-label="Загруженные файлы">
          {documents.map((document, index) => (
            <DocumentRow
              key={document.id}
              document={document}
              index={index}
              checked={selectedIds.has(document.id)}
              disabled={!!pending}
              retrying={
                pending?.kind === 'retry' &&
                !pending.bulk &&
                pending.documentIds[0] === document.id
              }
              onCheckedChange={(checked) => {
                changeSelection(document.id, checked);
              }}
              onOpen={() => {
                setViewing({
                  id: document.id,
                  filename: document.filename,
                  owner: { kind: 'recognition' },
                });
              }}
              onRetry={() => {
                run('retry', [document]);
              }}
              onDelete={() => {
                setDeleting([document]);
              }}
            />
          ))}
        </ul>
      )}
      <DocumentViewer
        document={viewing}
        requiresRetry={
          viewing !== undefined &&
          documents.find((item) => item.id === viewing.id)?.errorCode ===
            recognitionRetryCode
        }
        retryDisabled={!!pending}
        onRetry={retry}
        onClose={() => {
          setViewing(undefined);
        }}
      />
      <Confirm
        open={deleting.length > 0}
        title={
          deleting.length > 1
            ? `Удалить выбранные файлы (${String(deleting.length)})?`
            : `Удалить «${deleting[0]?.filename ?? ''}»?`
        }
        confirmLabel={
          deleting.length > 1 ? 'Удалить файлы' : 'Удалить документ'
        }
        pending={pending?.kind === 'delete'}
        onConfirm={() => {
          run('delete', deleting, deleting.length > 1);
        }}
        onCancel={() => {
          setDeleting([]);
        }}
      >
        Оригиналы и результаты распознавания будут удалены без возможности
        восстановления.
      </Confirm>
    </section>
  );
}
