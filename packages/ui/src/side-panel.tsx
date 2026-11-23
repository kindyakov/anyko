'use client';
import { X } from 'lucide-react';
import { type ReactNode, useId, useSyncExternalStore } from 'react';

import { Button } from './button';
import { Modal } from './modal';

// Tailwind `xl`: с этой ширины панель встаёт колонкой рядом с содержимым.
const wideQuery = '(min-width: 80rem)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(wideQuery);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Ширина окна, при которой `SidePanel` встаёт колонкой. */
export function useWideLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(wideQuery).matches,
    () => false,
  );
}

/**
 * Боковая панель инструмента, например помощника. На широком экране — колонка
 * рядом с содержимым: страница остаётся доступной, место под колонку выделяет
 * родитель. На узком — выдвижное окно справа поверх страницы.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  headerExtra,
  closeLabel = 'Закрыть панель',
  className = '',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  headerExtra?: ReactNode;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const wide = useWideLayout();
  const titleId = useId();
  if (!wide)
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        headerExtra={headerExtra}
        closeLabel={closeLabel}
        size="sheet"
        scrollBody={false}
      >
        {children}
      </Modal>
    );
  if (!open) return null;
  return (
    <aside
      aria-labelledby={titleId}
      className={`glass animate-rise sticky top-5 flex h-[calc(100dvh-2.5rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_-40px_#000] ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] py-2.5 pr-2.5 pl-4">
        <h2
          id={titleId}
          className="font-heading min-w-0 truncate text-base font-bold"
        >
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {headerExtra}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={closeLabel}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            <X size={17} />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
