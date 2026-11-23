import { type ComponentType, type ReactNode, useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { StatusPill, useToast } from '@anyko/ui';

import { ApiError, isUnauthorized } from '@/lib/api/errors';

import { useRecognitionAction } from '../api/commands';
import { actionNotice } from '../model/action-notice';
import {
  describeDocumentError,
  recognitionRetryCode,
} from '../model/error-texts';

import { ConfirmDocumentDeletion } from './catalog/confirm-document-deletion';
import {
  CatalogToolbar,
  DocumentSelectionActions,
} from './catalog/document-selection-actions';
import { CatalogSkeleton, DocumentTile } from './catalog/document-tile';
import { useCatalogView } from './catalog/use-catalog-view';
import { DocumentRow } from './document-row';
import { DocumentViewer, type ViewedDocument } from './document-viewer';

export function DocumentList({
  workspaceId,
  documents,
  total,
  observed,
  loading,
  filtered,
  track,
  search,
  pager,
  AddToWork,
  onDeletionAccepted,
}: {
  workspaceId: string;
  documents: DocumentSummary[];
  /** Всего файлов по текущим фильтрам, на всех страницах. */
  total: number;
  observed: DocumentSummary[];
  loading: boolean;
  filtered: boolean;
  track: (document: DocumentSummary) => void;
  search: ReactNode;
  pager: ReactNode;
  onDeletionAccepted?: (() => Promise<void>) | undefined;
  AddToWork?:
    | ComponentType<{
        selected: ReadonlyMap<string, string>;
        onClose: () => void;
      }>
    | undefined;
}) {
  const mutation = useRecognitionAction(workspaceId, track, onDeletionAccepted);
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
  const [workSelection, setWorkSelection] =
    useState<ReadonlyMap<string, string>>();
  const [deleting, setDeleting] = useState<DocumentSummary[]>([]);
  const { add } = useToast();
  const [view, setView] = useCatalogView();
  const Card = view === 'grid' ? DocumentTile : DocumentRow;
  const layout =
    view === 'grid'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3'
      : 'grid gap-2';
  const visibleIds = new Set(documents.map(({ id }) => id));
  const selected = [...selection.values()];
  const visibleSelected = documents.filter((document) =>
    selection.has(document.id),
  ).length;
  const retryable = selected.filter((document) => document.status === 'failed');
  const ready = selected.filter((document) => document.readyRevision != null);
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
    impacts?: ReadonlyMap<string, string>,
  ) {
    if (pending || targets.length === 0) return;
    const documentIds = targets.map((document) => document.id);
    if (kind === 'delete') {
      setViewing((current) =>
        current && documentIds.includes(current.id) ? undefined : current,
      );
    }
    mutation.mutate(
      { kind, documentIds, bulk, impacts },
      {
        onSuccess: ({ succeeded, failed }) => {
          if (kind === 'delete') {
            const retryConfirmation = new Set(
              failed
                .filter(
                  ({ error }) =>
                    error instanceof ApiError &&
                    [
                      'REVISION_CONFLICT',
                      'WORK_BUSY',
                      'DOCUMENT_IN_USE',
                    ].includes(error.code),
                )
                .map(({ id }) => id),
            );
            setDeleting(targets.filter(({ id }) => retryConfirmation.has(id)));
          }
          setSelection((previous) => {
            const next = new Map(previous);
            for (const id of succeeded) next.delete(id);
            return next;
          });
          add(actionNotice(kind, targets, { succeeded, failed }));
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
          {total > 0 && (
            <span className="text-muted ml-2 text-base font-medium tabular-nums">
              {total}
            </span>
          )}
        </h2>
        {processing > 0 && (
          <StatusPill tone="progress">Распознаётся: {processing}</StatusPill>
        )}
      </div>
      <CatalogToolbar
        disabled={!!pending}
        pageCount={documents.length}
        selectedOnPage={visibleSelected}
        search={search}
        view={view}
        onView={setView}
        onSelectPage={(checked) => {
          changeSelection(documents, checked);
        }}
      />
      <DocumentSelectionActions
        disabled={!!pending}
        retrying={pending?.kind === 'retry' && pending.bulk}
        retryable={retryable.length}
        selectedCount={selected.length}
        selectedOnPage={visibleSelected}
        addToWork={
          AddToWork && {
            count: ready.length,
            open: () => {
              setWorkSelection(
                new Map(ready.map(({ id, filename }) => [id, filename])),
              );
            },
          }
        }
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
      {AddToWork && workSelection && (
        <AddToWork
          selected={workSelection}
          onClose={() => {
            setWorkSelection(undefined);
          }}
        />
      )}
      {loading ? (
        <CatalogSkeleton view={view} className={layout} />
      ) : documents.length === 0 ? (
        <p className="glass text-muted rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm">
          {filtered
            ? 'Файлы по этим фильтрам не найдены.'
            : 'Здесь появятся загруженные файлы и результаты распознавания.'}
        </p>
      ) : (
        <ul className={layout} aria-label="Загруженные файлы">
          {documents.map((document, index) => (
            <Card
              key={document.id}
              workspaceId={workspaceId}
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
                  owner: {
                    kind: 'recognition',
                    ...(document.readyRevision != null && {
                      revision: document.readyRevision,
                    }),
                  },
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
      {pager && <div className="mt-6 flex justify-center">{pager}</div>}
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
      <ConfirmDocumentDeletion
        deleting={deleting}
        workspaceId={workspaceId}
        visible={visibleIds}
        pending={pending?.kind === 'delete'}
        onConfirm={(impacts) => {
          run('delete', deleting, deleting.length > 1, impacts);
        }}
        onCancel={() => {
          setDeleting([]);
        }}
      />
    </section>
  );
}
