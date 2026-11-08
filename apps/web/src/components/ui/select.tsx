'use client';
import { Select as Primitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

export function Select({
  items,
  name,
  disabled = false,
  defaultValue,
}: {
  items: { value: string; label: string }[];
  name: string;
  disabled?: boolean;
  defaultValue?: string;
}) {
  return (
    <Primitive.Root
      name={name}
      items={items}
      disabled={disabled}
      defaultValue={defaultValue ?? items[0]?.value ?? null}
      required
    >
      <Primitive.Trigger className="border-line bg-surface focus-visible:outline-brand flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 disabled:opacity-50">
        <Primitive.Value />
        <Primitive.Icon>
          <ChevronDown size={16} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner sideOffset={6} className="z-[60] outline-none">
          <Primitive.Popup className="border-line bg-surface text-ink max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border p-1 shadow-xl">
            <Primitive.List>
              {items.map((item) => (
                <Primitive.Item
                  key={item.value}
                  value={item.value}
                  className="data-[highlighted]:bg-canvas flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <Primitive.ItemText>{item.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={15} />
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
