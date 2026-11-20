'use client';

import { Switch } from '@base-ui/react/switch';

export function ScrollSyncSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="text-muted hover:text-ink focus-visible:outline-brand-hot group inline-flex min-h-9 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold transition-colors focus-visible:outline-2 disabled:opacity-60"
    >
      <span
        aria-hidden
        className="group-data-checked:bg-brand flex h-4 w-7 shrink-0 items-center rounded-full bg-white/[0.16] p-0.5 transition-colors"
      >
        <Switch.Thumb className="size-3 rounded-full bg-white shadow transition-transform data-checked:translate-x-3" />
      </span>
      Синхронная прокрутка
    </Switch.Root>
  );
}
