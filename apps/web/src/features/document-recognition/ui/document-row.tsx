import { AlertCircle, Clock3, Eye, Trash2 } from 'lucide-react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import {
  Button,
  Checkbox,
  FileIcon,
  HoverMist,
  RelativeTime,
  stagger,
  StatusPill,
  type Tone,
  Tooltip,
} from '@anyko/ui';

import {
  recognitionFailureText,
  recognitionRetryCode,
} from '../model/error-texts';

import { LinkedWorks } from './linked-works';
import { DocumentRetryButton } from './retry-button';

const labels: Record<DocumentSummary['status'], string> = {
  queued: 'В очереди',
  running: 'Распознаётся',
  succeeded: 'Распознан',
  failed: 'Ошибка',
};
const tones: Record<DocumentSummary['status'], Tone> = {
  queued: 'neutral',
  running: 'progress',
  succeeded: 'success',
  failed: 'danger',
};

export type DocumentCardProps = {
  workspaceId: string;
  document: DocumentSummary;
  index: number;
  checked: boolean;
  disabled: boolean;
  retrying: boolean;
  onCheckedChange: (checked: boolean) => void;
  onOpen: () => void;
  onRetry: () => void;
  onDelete: () => void;
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
    <Checkbox
      id={id}
      aria-label={label}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="size-5"
    />
  );
}

/** Время загрузки: значок часов и относительное время, точный момент — в подсказке. */
export function UploadedAt({
  document,
  className = '',
}: {
  document: DocumentSummary;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-zinc-400 tabular-nums ${className}`}
    >
      <Clock3 size={13} className="shrink-0 text-zinc-500" aria-hidden />
      <span className="sr-only">Загружен</span>
      <RelativeTime value={document.createdAt} />
    </span>
  );
}

/** Оболочка карточки файла: выделение, наведение и полоса обработки. */
export function cardSurface(checked: boolean, index: number) {
  return `animate-rise glass group/mist relative isolate overflow-hidden border transition-[border-color,box-shadow,background-color] duration-300 ease-out hover:border-[#ff3b62]/30 hover:shadow-[0_16px_50px_-24px_#db143c88] ${checked ? 'border-brand/50 bg-brand/[0.06]' : 'border-white/[0.07]'} ${stagger(index)}`;
}

export function DocumentStatus({ document }: { document: DocumentSummary }) {
  return (
    <StatusPill tone={tones[document.status]}>
      {labels[document.status]}
    </StatusPill>
  );
}

/** Причина ошибки распознавания: в списке — строкой под именем, в плитке — блоком. */
export function FailureReason({
  document,
  boxed = false,
}: {
  document: DocumentSummary;
  boxed?: boolean;
}) {
  if (document.status !== 'failed') return null;
  const reason =
    recognitionFailureText(document.errorCode) ??
    'Не удалось обработать документ.';
  return (
    <p
      className={`flex items-start gap-1.5 text-xs leading-5 text-red-300 ${boxed ? 'rounded-lg border border-red-400/20 bg-red-500/[0.06] px-2.5 py-2' : ''}`}
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span className={boxed ? 'line-clamp-3' : ''}>{reason}</span>
    </p>
  );
}

export function ProcessingStripe({ document }: { document: DocumentSummary }) {
  if (document.status !== 'queued' && document.status !== 'running')
    return null;
  return (
    <span
      aria-hidden
      className="animate-flow absolute inset-x-0 bottom-0 h-0.5 bg-[repeating-linear-gradient(90deg,#db143c_0_14px,transparent_14px_28px)]"
    />
  );
}

export function DocumentActions({
  document,
  disabled,
  retrying,
  onOpen,
  onRetry,
  onDelete,
  wide = false,
}: Pick<
  DocumentCardProps,
  'document' | 'disabled' | 'retrying' | 'onOpen' | 'onRetry' | 'onDelete'
> & { wide?: boolean }) {
  const canOpen =
    document.status === 'succeeded' ||
    document.readyRevision != null ||
    (document.status === 'failed' &&
      document.errorCode === recognitionRetryCode);
  return (
    <div className={`flex items-center gap-1 ${wide ? 'w-full' : ''}`}>
      {canOpen && (
        <Button
          variant="secondary"
          size="sm"
          className={wide ? 'flex-1' : ''}
          onClick={onOpen}
        >
          <Eye size={15} />
          Открыть
        </Button>
      )}
      {(document.status === 'failed' || document.status === 'succeeded') && (
        <DocumentRetryButton
          compact
          loading={retrying}
          disabled={disabled}
          onRetry={onRetry}
        />
      )}
      <Tooltip content="Удалить">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onDelete}
          aria-label={`Удалить ${document.filename}`}
          className="hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 size={16} />
        </Button>
      </Tooltip>
    </div>
  );
}

/** Файл в виде строки списка. */
export function DocumentRow(props: DocumentCardProps) {
  const { workspaceId, document, index, checked, disabled, onCheckedChange } =
    props;
  return (
    <li
      className={`${cardSurface(checked, index)} flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-3 py-3 sm:flex-nowrap sm:px-4`}
    >
      <ProcessingStripe document={document} />
      <HoverMist />
      <SelectionCheckbox
        label={`Выбрать ${document.filename}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FileIcon filename={document.filename} className="size-10" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-medium" title={document.filename}>
          {document.filename}
        </p>
        <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs empty:hidden">
          <UploadedAt document={document} className="md:hidden" />
          {!!document.linkedWorks?.length && (
            <LinkedWorks
              workspaceId={workspaceId}
              works={document.linkedWorks}
            />
          )}
        </div>
        <div className="mt-1.5 empty:hidden">
          <FailureReason document={document} />
        </div>
      </div>
      <UploadedAt
        document={document}
        className="hidden w-32 shrink-0 md:inline-flex"
      />
      <div className="ml-auto flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-between max-sm:pl-9">
        <DocumentStatus document={document} />
        <DocumentActions {...props} />
      </div>
    </li>
  );
}
