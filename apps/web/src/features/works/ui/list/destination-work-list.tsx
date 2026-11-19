import { ChevronRight, FolderOpen } from 'lucide-react';

import type { WorkPage } from '@anyko/contracts/works';
import { Button, RelativeTime, StatusPill } from '@anyko/ui';

export function DestinationWorkList({
  works,
  onSelect,
}: {
  works: WorkPage['items'];
  onSelect: (id: string) => void;
}) {
  return (
    <ul
      aria-label="Доступные работы"
      className="grid max-h-60 gap-1.5 overflow-y-auto p-0.5"
    >
      {works.map((item) => (
        <li key={item.id}>
          <Button
            variant="secondary"
            aria-label={item.title}
            aria-describedby={`work-option-${item.id}`}
            className="group h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left whitespace-normal"
            onClick={() => {
              onSelect(item.id);
            }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-rose-300">
              <FolderOpen size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold wrap-anywhere">
                {item.title}
              </span>
              <span
                id={`work-option-${item.id}`}
                className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal"
              >
                <StatusPill
                  tone={
                    item.confirmedRevision === item.revision
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {item.confirmedRevision === item.revision
                    ? 'Подтверждена'
                    : 'В работе'}
                </StatusPill>
                <span>
                  Изменена <RelativeTime value={item.updatedAt} />
                </span>
              </span>
            </span>
            <ChevronRight
              size={17}
              aria-hidden
              className="text-muted shrink-0 group-hover:text-rose-300"
            />
          </Button>
        </li>
      ))}
    </ul>
  );
}
