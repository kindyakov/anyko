'use client';
import { Menu } from '@base-ui/react/menu';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';

export type ActionMenuItem = {
  /** Ключ пункта, если подписи могут повторяться. */
  id?: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * Меню действий. Без `trigger` — кнопка «⋯» для редких действий (переименовать,
 * удалить); с `trigger` — кнопка с текстом, например выбор файла для привязки.
 */
export function ActionMenu({
  label,
  items,
  trigger,
  align = 'end',
  className = '',
}: {
  /** Доступное имя кнопки, например «Действия с работой»; включает видимый текст `trigger`. */
  label: string;
  items: ActionMenuItem[];
  trigger?: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            variant={trigger ? 'secondary' : 'ghost'}
            size={trigger ? 'sm' : 'icon-sm'}
            aria-label={label}
            className={`data-popup-open:text-ink data-popup-open:bg-white/[0.06] ${className}`}
          />
        }
      >
        {trigger ? (
          <>
            {trigger}
            <ChevronDown
              size={14}
              aria-hidden
              className="text-muted ml-auto shrink-0"
            />
          </>
        ) : (
          <MoreHorizontal size={18} />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align={align} className="z-[60]">
          <Menu.Popup className="bg-surface/95 max-h-72 max-w-[min(22rem,calc(100vw-2rem))] min-w-48 origin-(--transform-origin) overflow-y-auto rounded-xl border border-white/10 p-1 shadow-[0_18px_50px_-16px_#000] backdrop-blur-xl transition-[opacity,scale] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {items.map((item) => (
              <Menu.Item
                key={item.id ?? item.label}
                disabled={item.disabled}
                onClick={item.onSelect}
                className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 ${item.tone === 'danger' ? 'text-red-300 data-highlighted:bg-red-500/10 data-highlighted:text-red-200' : 'text-muted data-highlighted:text-ink data-highlighted:bg-white/[0.06]'}`}
              >
                {item.icon && (
                  <span aria-hidden className="grid size-4 place-items-center">
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 wrap-anywhere">{item.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
