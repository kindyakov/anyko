'use client';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/** Destructive confirmation; it stays open while the action is pending. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="text-ink fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,#18181cd9,#0d0d10e6)] p-6 shadow-[0_30px_120px_-20px_#000] backdrop-blur-2xl transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-7">
          <span className="mb-5 grid size-12 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
            <Trash2 size={20} />
          </span>
          <AlertDialog.Title className="font-heading text-xl font-bold tracking-tight wrap-anywhere">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted mt-3 text-sm leading-6">
            {children}
          </AlertDialog.Description>
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={pending} onClick={onCancel}>
              Отмена
            </Button>
            <Button variant="danger" loading={pending} onClick={onConfirm}>
              <Trash2 size={16} />
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
