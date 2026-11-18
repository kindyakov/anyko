import { type ReactNode, useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { Confirm, Skeleton, StatusPill, useToast } from '@anyko/ui';

import { isUnauthorized } from '@/lib/api/errors';

import { useRecognitionAction } from '../api/commands';
import {
  describeDocumentError,
  recognitionRetryCode,
} from '../model/error-texts';

import { DocumentSelectionActions } from './catalog/document-selection-actions';
import { DocumentRow } from './document-row';
import { DocumentViewer, type ViewedDocument } from './document-viewer';

export function DocumentList({
  workspaceId,
  documents,
  observed,
  loading,
  filtered,
  track,
  search,
  children,
}: {
  workspaceId: string;
  documents: DocumentSummary[];
  observed: DocumentSummary[];
  loading: boolean;
  filtered: boolean;
  track: (document: DocumentSummary) => void;
  search: ReactNode;
  children: ReactNode;
}) {
  const mutation = useRecognitionAction(workspaceId, track);
  const [selection, setSelection] = useState<Map<string, DocumentSummary>>(
    () => new Map(),
  );
  const [previousObserved, setPreviousObserved] = useState(observed);
  if (previousObserved !== observed) {
    setPreviousObserved(observed);
    setSelection((current) => {
      const updated = new Map(current);
      for (const document of observed) {
        if (updated.has(document.id)) updated.set(document.id, document);
      }
      return updated;
    });
  }
  const [viewing, setViewing] = useState<ViewedDocument>();
  const [deleting, setDeleting] = useState<DocumentSummary[]>([]);
  const { add } = useToast();
  const visibleDocuments = new Map(
    documents.map((document) => [document.id, document]),
  );
  const selected = [...selection.values()];
  const visibleSelected = documents.filter((document) =>
    selection.has(document.id),
  ).length;
  const retryable = selected.filter((document) => document.status === 'failed');
  const pending = mutation.isPending ? mutation.variables : undefined;
  const processing = documents.filter(
    (document) => document.status === 'queued' || document.status === 'running',
  ).length;

  function changeSelection(targets: DocumentSummary[], checked: boolean) {
    setSelection((previous) => {
      const next = new Map(previous);
      for (const document of targets) {
        if (checked) next.set(document.id, document);
        else next.delete(document.id);
      }
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
          setSelection((previous) => {
            const next = new Map(previous);
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
      {search}
      <DocumentSelectionActions
        disabled={!!pending}
        retrying={pending?.kind === 'retry' && pending.bulk}
        retryable={retryable.length}
        pageCount={documents.length}
        selectedCount={selected.length}
        selectedOnPage={visibleSelected}
        onSelectPage={(checked) => {
          changeSelection(documents, checked);
        }}
        onClear={() => {
          setSelection(new Map());
        }}
        onRetry={() => {
          run('retry', retryable, true);
        }}
        onDelete={() => {
          setDeleting(selected);
        }}
      />
      {children}
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
          {filtered
            ? 'Файлы по этим фильтрам не найдены.'
            : 'Здесь появятся загруженные файлы и результаты распознавания.'}
        </p>
      ) : (
        <ul className="grid gap-3" aria-label="Загруженные файлы">
          {documents.map((document, index) => (
            <DocumentRow
              key={document.id}
              document={document}
              index={index}
              checked={selection.has(document.id)}
              disabled={!!pending}
              retrying={
                pending?.kind === 'retry' &&
                !pending.bulk &&
                pending.documentIds[0] === document.id
              }
              onCheckedChange={(checked) => {
                changeSelection([document], checked);
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
        {deleting.some((document) => !visibleDocuments.has(document.id)) &&
          ' Выбор включает файлы за пределами текущей страницы.'}
      </Confirm>
    </section>
  );
}
