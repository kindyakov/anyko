import { Crosshair, TextCursorInput } from 'lucide-react';

import { Button, StatusPill, Tooltip } from '@anyko/ui';

/**
 * Шапка карточки поля: явно говорит, что это поле документа, и показывает
 * его состояние — заполнено, пусто, расхождение.
 */
export function FieldCardHeader({
  id,
  label,
  filled,
  conflict,
  evidenceLost,
  onJump,
}: {
  id: string;
  label: string;
  filled: boolean;
  conflict: boolean;
  evidenceLost: boolean;
  onJump: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p
          aria-hidden
          className="text-muted flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase"
        >
          <TextCursorInput size={13} />
          Поле документа
        </p>
        <h3
          id={id}
          tabIndex={-1}
          className="font-heading mt-1 rounded-md text-base leading-6 font-bold wrap-anywhere focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8da4]"
        >
          <span className="sr-only">Поле </span>
          {label}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
          {filled ? (
            <StatusPill tone="success">Заполнено</StatusPill>
          ) : (
            <StatusPill tone="neutral">Не заполнено</StatusPill>
          )}
          {conflict && <StatusPill tone="warning">Расхождение</StatusPill>}
          {evidenceLost && (
            <StatusPill tone="warning">Нужна повторная сверка</StatusPill>
          )}
        </div>
      </div>
      <Tooltip content="Показать, где это поле стоит в документе">
        <Button
          variant="ghost"
          size="xs"
          aria-label="Показать поле в документе"
          className="shrink-0"
          onClick={onJump}
        >
          <Crosshair size={14} aria-hidden />
          <span className="hidden sm:inline">Показать в документе</span>
        </Button>
      </Tooltip>
    </header>
  );
}
