import { Check, CheckCircle2, CircleHelp, Eye, Unlink } from 'lucide-react';

import type { WorkChecklistItem, WorkView } from '@anyko/contracts/works';
import { Button, Tooltip } from '@anyko/ui';

import { statuses } from './checklist-status';

type Document = WorkView['documents'][number];
type Source = WorkChecklistItem['sources'][number];

/**
 * Файл, найденный для пункта чек-листа: имя и страница, цитата из файла,
 * затем статус и подтверждение. Отвязка — тихая иконка с подсказкой.
 */
export function ChecklistSource({
  itemLabel,
  document,
  source,
  canEdit,
  pending,
  onOpen,
  onConfirm,
  onUnlink,
}: {
  itemLabel: string;
  document: Document;
  source: Source;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onUnlink: () => void;
}) {
  const [label, tone] = statuses[source.status];
  const StatusIcon =
    source.status === 'confirmed'
      ? CheckCircle2
      : tone === 'success'
        ? Check
        : CircleHelp;
  return (
    <li className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
      <div className="flex min-w-0 items-center gap-1">
        <Tooltip content="Открыть файл">
          <Button
            variant="ghost"
            size="xs"
            className="text-ink min-w-0 flex-1 justify-start"
            onClick={onOpen}
          >
            <Eye size={14} aria-hidden className="text-muted shrink-0" />
            <span className="min-w-0 truncate">{document.filename}</span>
          </Button>
        </Tooltip>
        {source.page && (
          <span className="text-muted shrink-0 text-[11px] tabular-nums">
            стр. {source.page}
          </span>
        )}
        {canEdit && (
          <Tooltip content="Отвязать файл от пункта">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0 hover:text-red-200"
              disabled={pending}
              aria-label={`Отвязать «${document.filename}» от «${itemLabel}»`}
              onClick={onUnlink}
            >
              <Unlink size={14} aria-hidden />
            </Button>
          </Tooltip>
        )}
      </div>
      {source.quote && (
        <p className="text-muted mt-1.5 line-clamp-4 border-l-2 border-white/10 pl-2.5 text-xs leading-5 wrap-anywhere">
          {source.quote}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone === 'success' ? 'text-emerald-300' : tone === 'progress' ? 'text-amber-200' : 'text-muted'}`}
        >
          <StatusIcon size={12} aria-hidden />
          {label}
        </span>
        {canEdit && source.status !== 'confirmed' && (
          <Button
            variant="success"
            size="xs"
            disabled={pending}
            onClick={onConfirm}
          >
            <Check size={13} aria-hidden />
            Подтвердить
          </Button>
        )}
      </div>
    </li>
  );
}
