import { Popover } from '@base-ui/react/popover';
import { FolderOpen } from 'lucide-react';
import Link from 'next/link';

import type { DocumentSummary } from '@anyko/contracts/documents';

import { routes } from '@/lib/routes';

export function LinkedWorks({
  workspaceId,
  works,
}: {
  workspaceId: string;
  works: NonNullable<DocumentSummary['linkedWorks']>;
}) {
  const visible = works.slice(0, 2);
  const more = works.slice(2);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Связанные работы"
    >
      <span className="text-muted text-xs">В работах</span>
      {visible.map(({ id, title }) => (
        <Link
          key={id}
          href={routes.work(workspaceId, id)}
          prefetch={false}
          title={title}
          className="focus-visible:outline-brand-hot inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-rose-400/20 bg-rose-400/[0.07] px-2 py-1 text-xs font-medium text-rose-200 transition-colors hover:border-rose-400/45 hover:bg-rose-400/15 focus-visible:outline-2"
        >
          <FolderOpen size={13} className="shrink-0" aria-hidden />
          <span className="max-w-48 truncate">{title}</span>
        </Link>
      ))}
      {more.length > 0 && (
        <Popover.Root>
          <Popover.Trigger className="focus-visible:outline-brand-hot rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-white/10 focus-visible:outline-2">
            Ещё {more.length}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} align="start" className="z-50">
              <Popover.Popup className="max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/15 bg-[#171419] p-2 shadow-xl">
                <Popover.Title className="text-muted px-2 py-1 text-xs font-medium">
                  Другие связанные работы
                </Popover.Title>
                <ul>
                  {more.map(({ id, title }) => (
                    <li key={id}>
                      <Link
                        href={routes.work(workspaceId, id)}
                        prefetch={false}
                        className="focus-visible:outline-brand-hot flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm wrap-anywhere text-rose-100 hover:bg-rose-400/10 focus-visible:outline-2"
                      >
                        <FolderOpen
                          size={15}
                          className="mt-0.5 shrink-0"
                          aria-hidden
                        />
                        <span className="min-w-0">{title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
