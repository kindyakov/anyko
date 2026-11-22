'use client';

import { Select as Primitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

import { fieldSurface } from './input';

export function Select({
  label,
  items,
  value,
  onValueChange,
  disabled,
  placeholder,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Primitive.Root
      items={items}
      disabled={disabled}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <Primitive.Trigger
        aria-label={label}
        className={`${fieldSurface} flex min-h-9 items-center justify-between gap-2 px-2.5 text-left`}
      >
        <Primitive.Value
          placeholder={placeholder}
          className="min-w-0 truncate"
        />
        <Primitive.Icon className="text-muted shrink-0">
          <ChevronDown size={15} aria-hidden />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner
          alignItemWithTrigger={false}
          sideOffset={5}
          className="z-50"
        >
          <Primitive.Popup className="bg-surface max-h-(--available-height) w-(--anchor-width) overflow-y-auto rounded-xl border border-white/10 p-1 shadow-xl outline-none">
            <Primitive.List>
              {items.map((item) => (
                <Primitive.Item
                  key={item.value}
                  value={item.value}
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2 py-1 text-sm outline-none data-highlighted:bg-white/10"
                >
                  <Primitive.ItemText className="min-w-0 flex-1 wrap-anywhere">
                    {item.label}
                  </Primitive.ItemText>
                  <Primitive.ItemIndicator className="text-brand-hot shrink-0">
                    <Check size={15} aria-hidden />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
