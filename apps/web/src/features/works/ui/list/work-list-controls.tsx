import { Field } from '@base-ui/react/field';
import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, LayoutGrid, List, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, buttonStyles, Input, SegmentedControl } from '@anyko/ui';

import type {
  WorkListParams,
  WorkListView,
} from '@/features/works/model/work-list';

const layouts = [
  { value: 'tiles', label: 'Плитка', Icon: LayoutGrid },
  { value: 'list', label: 'Список', Icon: List },
] as const;

export function WorkListControls({
  params,
  onChange,
}: {
  params: WorkListParams;
  onChange: (changes: Partial<WorkListParams>, mode?: 'replace') => void;
}) {
  const { q, status, view } = params;
  const [draft, setDraft] = useState({ initial: q, value: q });
  if (draft.initial !== q) setDraft({ initial: q, value: q });
  const value = draft.initial === q ? draft.value : q;
  const search = value.trim();
  const ViewIcon = view === 'tiles' ? LayoutGrid : List;

  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => {
      onChange({ q: search, page: 1 }, 'replace');
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search, q, onChange]);

  return (
    <div className="animate-rise mb-6 flex flex-wrap items-center gap-3 [animation-delay:80ms]">
      <SegmentedControl
        label="Статус работы"
        value={status}
        onValueChange={(next) => {
          onChange({ status: next, page: 1, q: search });
        }}
        items={[
          { value: 'all', label: 'Все', accessibleLabel: 'Все работы' },
          { value: 'draft', label: 'В работе' },
          { value: 'confirmed', label: 'Подтверждённые' },
        ]}
      />
      <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
        <Field.Root className="relative min-w-44 flex-1 sm:w-72">
          <Search
            size={16}
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <Input
            aria-label="Поиск работ по названию"
            placeholder="Найти работу"
            className="pr-11 pl-10"
            maxLength={200}
            value={value}
            onChange={(event) => {
              setDraft({ initial: q, value: event.target.value });
            }}
          />
          {value && (
            <span className="absolute top-1 right-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Очистить поиск"
                onClick={() => {
                  setDraft({ initial: q, value: '' });
                  onChange({ q: '', page: 1 }, 'replace');
                }}
              >
                <X size={15} />
              </Button>
            </span>
          )}
        </Field.Root>
        <Select.Root<WorkListView>
          items={layouts}
          value={view}
          onValueChange={(next) => {
            if (next) onChange({ view: next }, 'replace');
          }}
        >
          <Select.Trigger
            aria-label="Вид списка работ"
            className={`${buttonStyles({ variant: 'secondary' })} group data-popup-open:border-brand/45 w-auto min-w-32 justify-start`}
          >
            <ViewIcon size={16} aria-hidden className="text-brand-hot" />
            <Select.Value />
            <Select.Icon className="text-muted ml-auto transition-transform group-data-popup-open:rotate-180">
              <ChevronDown size={14} aria-hidden />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              align="end"
              alignItemWithTrigger={false}
              sideOffset={8}
              className="z-40 min-w-40"
            >
              <Select.Popup className="bg-surface rounded-2xl border border-white/10 p-1.5 shadow-[0_16px_40px_-12px_#000c] transition-[opacity,translate] duration-150 outline-none data-ending-style:opacity-0 data-starting-style:translate-y-1 data-starting-style:opacity-0">
                <Select.List>
                  {layouts.map(({ value: layout, label, Icon }) => (
                    <Select.Item
                      key={layout}
                      value={layout}
                      className="text-muted data-highlighted:text-ink data-selected:text-ink flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none data-highlighted:bg-white/[0.06]"
                    >
                      <Icon size={16} aria-hidden />
                      <Select.ItemText>{label}</Select.ItemText>
                      <Select.ItemIndicator className="text-brand-hot ml-auto">
                        <Check size={15} aria-hidden />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    </div>
  );
}
