import { Checkbox } from '@base-ui/react/checkbox';
import { Check, Eye, Minus, Trash2 } from 'lucide-react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import {
  Button,
  FileIcon,
  HoverMist,
  RelativeTime,
  stagger,
  StatusPill,
  type Tone,
} from '@anyko/ui';

import {
  recognitionFailureText,
  recognitionRetryCode,
} from '../model/error-texts';

import { DocumentRetryButton } from './retry-button';

const labels: Record<DocumentSummary['status'], string> = {
  queued: 'В очереди',
  running: 'Распознаётся',
  succeeded: 'Распознан',
  failed: 'Не удалось обработать',
};
const tones: Record<DocumentSummary['status'], Tone> = {
  queued: 'neutral',
  running: 'progress',
  succeeded: 'success',
  failed: 'danger',
};

export function SelectionCheckbox({
  id,
  label,
  checked,
  indeterminate = false,
  disabled,
  onCheckedChange,
}: {
  id?: string;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox.Root
      id={id}
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="text-ink focus-visible:outline-brand-hot data-checked:border-brand/70 data-checked:bg-brand/25 data-indeterminate:border-brand/70 data-indeterminate:bg-brand/25 grid size-6 shrink-0 place-items-center rounded-md border border-white/20 bg-white/5 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-3 data-disabled:opacity-50"
    >
      <Checkbox.Indicator>
        {indeterminate ? <Minus size={16} /> : <Check size={16} />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}

export function DocumentRow({
  document,
  index,
  checked,
  disabled,
  retrying,
  onCheckedChange,
  onOpen,
  onRetry,
  onDelete,
}: {
  document: DocumentSummary;
  index: number;
  checked: boolean;
  disabled: boolean;
  retrying: boolean;
  onCheckedChange: (checked: boolean) => void;
  onOpen: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const busy = document.status === 'queued' || document.status === 'running';
  const requiresRetry =
    document.status === 'failed' && document.errorCode === recognitionRetryCode;
  return (
    <li
      className={`animate-rise glass group/mist relative isolate flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border p-4 transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/30 hover:shadow-[0_16px_50px_-24px_#db143c88] xl:flex-nowrap ${checked ? 'border-brand/50' : 'border-white/[0.07]'} ${stagger(index)}`}
    >
      {busy && (
        <span
          aria-hidden
          className="animate-flow absolute inset-x-0 bottom-0 h-0.5 bg-[repeating-linear-gradient(90deg,#db143c_0_14px,transparent_14px_28px)]"
        />
      )}
      <HoverMist />
      <SelectionCheckbox
        label={`Выбрать ${document.filename}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FileIcon filename={document.filename} />
      <div className="min-w-0 flex-1 basis-36">
        <p className="font-medium wrap-anywhere">{document.filename}</p>
        <p className="text-muted mt-1 text-xs">
          Загружен <RelativeTime value={document.createdAt} />
        </p>
      </div>
      <StatusPill tone={tones[document.status]}>
        {(document.status === 'failed' &&
          recognitionFailureText(document.errorCode)) ||
          labels[document.status]}
      </StatusPill>
      <div className="flex flex-wrap gap-2">
        {document.status === 'failed' && (
          <DocumentRetryButton
            loading={retrying}
            disabled={disabled}
            onRetry={onRetry}
          />
        )}
        {(document.status === 'succeeded' || requiresRetry) && (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            <Eye size={15} />
            Открыть
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onDelete}
          aria-label={`Удалить ${document.filename}`}
          title="Удалить"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </li>
  );
}
