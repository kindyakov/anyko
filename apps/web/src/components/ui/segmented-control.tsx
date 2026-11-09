'use client';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  label,
  size = 'md',
}: {
  value: T | undefined;
  onValueChange: (value: T) => void;
  items: { value: T; label: ReactNode; accessibleLabel?: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={value === undefined ? [] : [value]}
      onValueChange={(next) => {
        if (next[0] !== undefined) onValueChange(next[0]);
      }}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-black/40 p-1"
    >
      {items.map((item) => (
        <Toggle
          key={item.value}
          value={item.value}
          aria-label={item.accessibleLabel}
          title={item.accessibleLabel}
          className={`text-muted hover:text-ink data-[pressed]:text-ink focus-visible:outline-brand-hot relative flex items-center justify-center gap-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 outline-none hover:bg-white/[0.04] focus-visible:outline-2 data-[pressed]:bg-white/[0.08] data-[pressed]:shadow-[inset_0_1px_0_#ffffff14,0_0_0_1px_#ffffff10] ${size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3.5 text-sm'}`}
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
