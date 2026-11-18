import { X } from 'lucide-react';

import { Button, StatusPill } from '@anyko/ui';

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
    <ul
      aria-label="Выбранные файлы"
      className="grid max-h-36 gap-1 overflow-auto"
    >
      {[...selected].map(([id, name]) => (
        <li
          key={id}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1 text-sm"
        >
          <span className="min-w-0 flex-1 wrap-anywhere">{name}</span>
          {attached?.has(id) && (
            <StatusPill tone="neutral">Уже в работе</StatusPill>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
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
  );
}
