import { RotateCw, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@anyko/ui';

import { SelectionCheckbox } from '../document-row';

export function DocumentSelectionActions({
  disabled,
  retrying,
  retryable,
  pageCount,
  selectedCount,
  selectedOnPage,
  onSelectPage,
  onClear,
  onRetry,
  onDelete,
}: {
  disabled: boolean;
  retrying: boolean;
  retryable: number;
  pageCount: number;
  selectedCount: number;
  selectedOnPage: number;
  onSelectPage: (checked: boolean) => void;
  onClear: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const selectAllId = useId();
  if (!pageCount && !selectedCount) return null;
  return (
    <div className="glass mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 px-4 py-2">
      {pageCount > 0 && (
        <label
          htmlFor={selectAllId}
          className="flex items-center gap-2 text-sm"
        >
          <SelectionCheckbox
            id={selectAllId}
            label="Выбрать все файлы на странице"
            checked={selectedOnPage === pageCount}
            indeterminate={selectedOnPage > 0 && selectedOnPage < pageCount}
            disabled={disabled}
            onCheckedChange={onSelectPage}
          />
          Все на странице
        </label>
      )}
      {selectedCount > 0 && (
        <>
          <span className="text-muted text-sm" role="status">
            Выбрано: {selectedCount}
          </span>
          {selectedCount > selectedOnPage && (
            <span className="text-muted text-sm">
              Вне страницы: {selectedCount - selectedOnPage}
            </span>
          )}
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onClear}
            >
              Снять выбор
            </Button>
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
        </>
      )}
    </div>
  );
}
