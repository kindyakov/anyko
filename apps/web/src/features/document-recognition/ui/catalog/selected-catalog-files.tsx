import { X } from 'lucide-react';

import { Button, FileIcon, StatusPill } from '@anyko/ui';

export function SelectedCatalogFiles({
  selected,
  attached,
  disabled,
  onRemove,
}: {
  selected: ReadonlyMap<string, string>;
  attached?: ReadonlySet<string>;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  if (!selected.size) return null;
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02]">
      <h3 className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3 text-sm font-semibold">
        Выбранные файлы
        <span className="text-muted rounded-full bg-white/[0.06] px-2 py-0.5 text-xs tabular-nums">
          {selected.size}
        </span>
      </h3>
      <ul
        aria-label="Выбранные файлы"
        className="max-h-52 divide-y divide-white/[0.06] overflow-y-auto"
      >
        {[...selected].map(([id, name]) => (
          <li
            key={id}
            className="flex min-w-0 items-center gap-3 py-2.5 pr-3 pl-4 text-sm"
          >
            <FileIcon filename={name} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="font-medium wrap-anywhere">{name}</p>
              {attached?.has(id) && (
                <span className="mt-1 inline-block">
                  <StatusPill tone="neutral">Уже в работе</StatusPill>
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={`Снять выбор файла ${name}`}
              onClick={() => {
                onRemove(id);
              }}
            >
              <X size={15} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
