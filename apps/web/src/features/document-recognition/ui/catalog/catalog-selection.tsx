'use client';
import { useQuery } from '@tanstack/react-query';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { workSourceLimit } from '@anyko/contracts/works';
import { FileIcon, Notice, Pager, StatusPill } from '@anyko/ui';
import { HorizonLoader } from '@anyko/ui/brand';

import { useWorkspaceEvents } from '@/lib/api/live-events';

import { type DocumentFilters, documentsQueryOptions } from '../../api/queries';
import {
  describeDocumentError,
  recognitionFailureText,
} from '../../model/error-texts';
import { SelectionCheckbox } from '../document-row';

import { DocumentSearch } from './document-search';

const selectionPageSize = 12;

function unavailableReason(document: DocumentSummary) {
  if (document.status === 'running' || document.status === 'queued')
    return 'Ожидается готовый результат';
  return (
    recognitionFailureText(document.errorCode) ?? 'Нет готового результата'
  );
}

export function CatalogSelection({
  workspaceId,
  selected,
  setSelected,
  attached,
  disabled = false,
}: {
  workspaceId: string;
  selected: ReadonlyMap<string, string>;
  setSelected: Dispatch<SetStateAction<Map<string, string>>>;
  attached?: ReadonlySet<string>;
  disabled?: boolean;
}) {
  useWorkspaceEvents(workspaceId);
  const [filters, setFilters] = useState<DocumentFilters>({
    q: '',
    formats: [],
  });
  const [page, setPage] = useState(1);
  const query = useQuery(
    documentsQueryOptions(workspaceId, filters, page, selectionPageSize),
  );
  const remaining = Math.max(0, workSourceLimit - (attached?.size ?? 0));
  const rows = query.data?.items ?? [];
  // Сервер сводит номер за последней страницей к последней.
  const shownPage = (!query.isPlaceholderData && query.data?.page) || page;
  const changeFilters = useCallback((value: DocumentFilters) => {
    setFilters(value);
    setPage(1);
  }, []);
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <DocumentSearch
        filters={filters}
        onChange={changeFilters}
        catalog
        empty={query.isSuccess && query.data.total === 0}
      />
      {query.error && (
        <Notice role="alert" tone="danger" title="Каталог недоступен">
          {describeDocumentError(query.error)}
        </Notice>
      )}
      {query.isPending && <HorizonLoader label="Загружаем файлы" />}
      {rows.length > 0 && (
        <ul
          className="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1"
          aria-label="Документы каталога"
        >
          {rows.map((document) => {
            const already = attached?.has(document.id) ?? false;
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
                    disabled ||
                    (!checked && (!ready || selected.size >= remaining))
                  }
                  onCheckedChange={(enabled) => {
                    setSelected((previous) => {
                      const update = new Map(previous);
                      if (enabled) update.set(document.id, document.filename);
                      else update.delete(document.id);
                      return update;
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
      {query.data && (
        <Pager
          label="Страницы каталога"
          page={shownPage}
          pages={Math.ceil(query.data.total / query.data.pageSize)}
          onPage={setPage}
        />
      )}
      <p className="text-muted text-xs" role="status">
        Свободных мест для файлов: {Math.max(0, remaining - selected.size)}
      </p>
    </div>
  );
}
