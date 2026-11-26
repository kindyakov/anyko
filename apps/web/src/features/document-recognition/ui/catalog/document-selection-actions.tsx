import {
  FolderPlus,
  LayoutGrid,
  List,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { Button, SegmentedControl } from '@anyko/ui';

import { SelectionCheckbox } from '../document-row';

import type { useCatalogView } from './use-catalog-view';

type CatalogView = ReturnType<typeof useCatalogView>[0];

/** Панель инструментов каталога: выбор страницы, поиск и вид. */
export function CatalogToolbar({
  search,
  view,
  onView,
  ...selection
}: Parameters<typeof SelectPage>[0] & {
  search: ReactNode;
  view: CatalogView;
  onView: (view: CatalogView) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SelectPage {...selection} />
      {search}
      <SegmentedControl
        label="Вид каталога"
        value={view}
        onValueChange={onView}
        items={[
          {
            value: 'list',
            label: <List size={16} aria-hidden />,
            accessibleLabel: 'Списком',
          },
          {
            value: 'grid',
            label: <LayoutGrid size={16} aria-hidden />,
            accessibleLabel: 'Плитками',
          },
        ]}
      />
    </div>
  );
}

/** Флажок «Все на странице» для панели инструментов каталога. */
function SelectPage({
  disabled,
  pageCount,
  selectedOnPage,
  onSelectPage,
}: {
  disabled: boolean;
  pageCount: number;
  selectedOnPage: number;
  onSelectPage: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm transition-colors hover:border-white/20"
    >
      <SelectionCheckbox
        id={id}
        label="Выбрать все файлы на странице"
        checked={pageCount > 0 && selectedOnPage === pageCount}
        indeterminate={selectedOnPage > 0 && selectedOnPage < pageCount}
        disabled={disabled || pageCount === 0}
        onCheckedChange={onSelectPage}
      />
      Все
    </label>
  );
}

/** Панель действий над выбранными файлами; видна, только пока выбор не пуст. */
export function DocumentSelectionActions({
  disabled,
  retrying,
  retryable,
  selectedCount,
  selectedOnPage,
  onClear,
  onRetry,
  addToWork,
  onDelete,
}: {
  disabled: boolean;
  retrying: boolean;
  retryable: number;
  selectedCount: number;
  selectedOnPage: number;
  onClear: () => void;
  onRetry: () => void;
  addToWork?: { count: number; open: () => void } | undefined;
  onDelete: () => void;
}) {
  if (!selectedCount) return null;
  return (
    <div className="animate-rise border-brand/30 sticky top-3 z-20 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-[#1a0f13]/90 py-2 pr-2 pl-4 shadow-[0_16px_40px_-20px_#000,0_0_40px_-24px_#db143c] backdrop-blur-xl">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium" role="status">
          Выбрано: {selectedCount}
        </span>
        {selectedCount > selectedOnPage && (
          <span className="text-muted">
            Вне страницы: {selectedCount - selectedOnPage}
          </span>
        )}
        <Button variant="ghost" size="xs" disabled={disabled} onClick={onClear}>
          <X size={14} aria-hidden />
          Снять выбор
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {addToWork && (
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled || !addToWork.count}
            onClick={addToWork.open}
          >
            <FolderPlus size={15} aria-hidden /> Добавить в работу
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || retryable === 0}
          loading={retrying}
          onClick={onRetry}
        >
          <RotateCw size={15} />
          Повторить распознавание
          {retryable > 0 ? ` (${String(retryable)})` : ''}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 size={15} />
          Удалить выбранные
        </Button>
      </div>
    </div>
  );
}
