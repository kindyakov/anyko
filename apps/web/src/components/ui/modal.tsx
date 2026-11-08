'use client';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

const backdrop =
  'fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0';

/** Centered dialog (`size="wide"` for document viewers) or a right-side sheet. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'normal',
  closeLabel = 'Закрыть',
  headerExtra,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'normal' | 'wide' | 'sheet';
  closeLabel?: string;
  headerExtra?: ReactNode;
  dismissible?: boolean;
}) {
  const popup =
    size === 'sheet'
      ? 'top-0 right-0 h-dvh w-full max-w-xl border-l data-ending-style:translate-x-full data-starting-style:translate-x-full'
      : size === 'wide'
        ? 'top-3 left-1/2 h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1500px] -translate-x-1/2 rounded-3xl border data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0'
        : 'top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0';
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (dismissible || next) onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Popup
          className={`text-ink fixed z-50 flex flex-col overflow-hidden border-white/10 bg-[linear-gradient(180deg,#16161a,#0c0c0f)] shadow-[0_30px_120px_-20px_#000,0_0_0_1px_#ffffff08,0_0_80px_-40px_#db143c] transition-[opacity,scale,translate] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] outline-none ${popup}`}
        >
          <span
            aria-hidden
            className="via-brand-hot/70 pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent to-transparent"
          />
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              <Dialog.Title className="font-heading text-xl font-bold tracking-tight wrap-anywhere sm:text-2xl">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-muted mt-2 text-sm leading-6">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerExtra}
              <Dialog.Close
                disabled={!dismissible}
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={closeLabel}
                  />
                }
              >
                <X size={18} />
              </Dialog.Close>
            </div>
          </div>
          <div
            className={`min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8 ${size === 'wide' ? 'flex flex-col pt-4' : 'pt-6'}`}
          >
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
