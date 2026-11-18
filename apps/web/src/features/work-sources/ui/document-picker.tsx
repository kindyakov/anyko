import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { Button, FileIcon, Modal, Notice, StatusPill } from '@anyko/ui';

import {
  describeDocumentError,
  type DocumentFilters,
  DocumentSearch,
  documentsQueryOptions,
  recognitionFailureText,
  SelectionCheckbox,
} from '@/features/document-recognition';
import { ApiError } from '@/lib/api/errors';

import { useAttachWorkDocuments } from '../api/commands';

function unavailableReason(document: DocumentSummary) {
  if (document.status === 'running' || document.status === 'queued')
    return 'Ожидается готовый результат';
  return (
    recognitionFailureText(document.errorCode) ?? 'Нет готового результата'
  );
}

export function DocumentPicker({
  workspaceId,
  workId,
  attached,
  onClose,
}: {
  workspaceId: string;
  workId: string;
  attached: readonly DocumentSummary[];
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<DocumentFilters>({
    q: '',
    formats: [],
  });
  const [cursors, setCursors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [failure, setFailure] = useState('');
  const query = useQuery(
    documentsQueryOptions(workspaceId, filters, cursors.at(-1)),
  );
  const attach = useAttachWorkDocuments(workspaceId, workId);
  const attachedIds = new Set(attached.map(({ id }) => id));
  const remaining = Math.max(0, 20 - attachedIds.size);
  const next = query.data?.nextCursor;
  const rows = query.data?.items ?? [];
  const changeFilters = useCallback((value: DocumentFilters) => {
    setFilters(value);
    setCursors([]);
  }, []);

  function submit() {
    const ids = [...selected.keys()];
    setFailure('');
    attach.mutate(ids, {
      onSuccess: onClose,
      onError: (error) => {
        const unavailable =
          error instanceof ApiError && error.code === 'NOT_READY'
            ? (error.fields?.flatMap(({ path }) => {
                const id =
                  path[0] === 'documentIds' && typeof path[1] === 'number'
                    ? ids[path[1]]
                    : undefined;
                return id ? [id] : [];
              }) ?? [])
            : [];
        if (!unavailable.length) {
          setFailure(describeDocumentError(error));
          return;
        }
        setFailure(
          `Файлы стали недоступны: ${unavailable.map((id) => selected.get(id)).join(', ')}.`,
        );
        setSelected((previous) => {
          const next = new Map(previous);
          for (const id of unavailable) next.delete(id);
          return next;
        });
        void query.refetch();
      },
    });
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={!attach.isPending}
      title="Добавить из каталога"
      description="Выберите файлы с готовым распознаванием."
    >
      <DocumentSearch filters={filters} onChange={changeFilters} />
      {query.error && (
        <Notice role="alert" tone="danger" title="Каталог недоступен">
          {describeDocumentError(query.error)}
        </Notice>
      )}
      {query.isPending && (
        <p className="text-muted py-4 text-sm" role="status">
          Загружаем файлы…
        </p>
      )}
      {query.isSuccess && rows.length === 0 && (
        <p className="text-muted py-4 text-sm">
          Файлы по этим фильтрам не найдены.
        </p>
      )}
      {rows.length > 0 && (
        <ul
          className="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1"
          aria-label="Документы каталога"
        >
          {rows.map((document) => {
            const already = attachedIds.has(document.id);
            const checked = selected.has(document.id);
            const ready = document.readyRevision != null;
            return (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2"
              >
                <SelectionCheckbox
                  label={`Выбрать ${document.filename}`}
                  checked={already || checked}
                  disabled={
                    already ||
                    attach.isPending ||
                    (!checked && (!ready || selected.size >= remaining))
                  }
                  onCheckedChange={(enabled) => {
                    setSelected((previous) => {
                      const next = new Map(previous);
                      if (enabled) next.set(document.id, document.filename);
                      else next.delete(document.id);
                      return next;
                    });
                  }}
                />
                <FileIcon filename={document.filename} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium wrap-anywhere">
                    {document.filename}
                  </p>
                  {!already && !ready && (
                    <p className="text-muted mt-1 text-xs">
                      {unavailableReason(document)}
                    </p>
                  )}
                </div>
                {already && (
                  <StatusPill tone="neutral">Уже в работе</StatusPill>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(cursors.length > 0 || !!next) && (
        <nav
          className="mt-3 flex items-center gap-2"
          aria-label="Страницы каталога"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={!cursors.length}
            onClick={() => {
              setCursors((previous) => previous.slice(0, -1));
            }}
          >
            <ChevronLeft size={15} aria-hidden /> Назад
          </Button>
          <span className="text-muted text-sm" aria-live="polite">
            Страница {cursors.length + 1}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!next}
            onClick={() => {
              if (next) setCursors([...cursors, next]);
            }}
          >
            Далее <ChevronRight size={15} aria-hidden />
          </Button>
        </nav>
      )}
      {failure && (
        <div className="mt-4">
          <Notice role="alert" tone="danger" title="Не удалось добавить файлы">
            {failure}
          </Notice>
        </div>
      )}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-muted text-sm" role="status">
          Выбрано: {selected.size} из {remaining}
        </p>
        <Button
          disabled={!selected.size || selected.size > remaining}
          loading={attach.isPending}
          onClick={submit}
        >
          Добавить файлы
        </Button>
      </footer>
    </Modal>
  );
}
