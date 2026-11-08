'use client';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  label,
}: {
  value: T | undefined;
  onValueChange: (value: T) => void;
  items: { value: T; label: ReactNode; accessibleLabel?: string }[];
  label: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={value === undefined ? [] : [value]}
      onValueChange={(next) => {
        if (next[0] !== undefined) onValueChange(next[0]);
      }}
      className="border-line bg-canvas flex w-fit max-w-full flex-wrap gap-1 rounded-xl border p-1"
    >
      {items.map((item) => (
        <Toggle
          key={item.value}
          value={item.value}
          aria-label={item.accessibleLabel}
          title={item.accessibleLabel}
          className="text-muted hover:text-ink data-[pressed]:bg-surface data-[pressed]:text-ink focus-visible:outline-brand flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:outline-2 data-[pressed]:shadow-xs"
        >
          {item.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
