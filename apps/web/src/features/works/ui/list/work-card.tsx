import { Menu } from '@base-ui/react/menu';
import { ArrowUpRight, Ellipsis, FileStack, Trash2 } from 'lucide-react';
import Link from 'next/link';

import type { DocumentPackage } from '@anyko/contracts/catalog';
import type { WorkPage } from '@anyko/contracts/works';
import {
  buttonStyles,
  HoverMist,
  RelativeTime,
  stagger,
  StatusPill,
} from '@anyko/ui';

import type { WorkListView } from '@/features/works/model/work-list';
import { routes } from '@/lib/routes';

export function WorkCard({
  work,
  index,
  packages,
  workspaceId,
  view,
  onDelete,
}: {
  work: WorkPage['items'][number];
  index: number;
  packages: readonly DocumentPackage[];
  workspaceId: string;
  view: WorkListView;
  onDelete?: (() => void) | undefined;
}) {
  const confirmed = work.confirmedRevision === work.revision;
  const pack = packages.find((item) => item.version === work.packageVersion);
  const tiles = view === 'tiles';
  return (
    <li className={`animate-rise relative ${stagger(index)}`}>
      <Link
        href={routes.work(workspaceId, work.id)}
        className={`group group/mist focus-visible:outline-brand-hot glass relative isolate flex h-full overflow-hidden border border-white/[0.07] transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/40 hover:shadow-[0_20px_60px_-20px_#db143c88] focus-visible:outline-2 focus-visible:outline-offset-2 ${tiles ? 'flex-col rounded-3xl p-6' : 'flex-wrap items-center gap-3 rounded-2xl px-4 py-3 sm:flex-nowrap'} ${!tiles && onDelete ? 'pr-14' : ''}`}
      >
        <HoverMist />
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors duration-300 group-hover:border-[#ff3b62]/40 group-hover:text-[#ff6a88]">
            <FileStack size={20} strokeWidth={1.6} />
          </span>
          {tiles && !onDelete && (
            <ArrowUpRight size={20} className="text-muted" />
          )}
        </div>
        <div className={tiles ? 'mt-6' : 'min-w-0 flex-1 basis-44'}>
          <h2
            className={`font-heading leading-snug font-bold tracking-tight wrap-anywhere ${tiles ? 'text-lg' : 'text-base'}`}
          >
            {work.title}
          </h2>
          <p className="text-muted mt-1 text-sm wrap-anywhere">
            {pack?.title ?? 'Комплект документов'}
          </p>
        </div>
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${tiles ? 'mt-auto pt-7' : 'sm:min-w-52'}`}
        >
          {confirmed ? (
            <StatusPill tone="success">Подтверждена</StatusPill>
          ) : (
            <StatusPill tone="brand">В работе</StatusPill>
          )}
          <span className="text-muted text-xs">
            Изменена <RelativeTime value={work.updatedAt} />
          </span>
        </div>
      </Link>
      {onDelete && (
        <div
          className={`absolute ${tiles ? 'top-4 right-4' : 'top-4 right-2'}`}
        >
          <Menu.Root>
            <Menu.Trigger
              aria-label={`Действия с работой «${work.title}»`}
              className={buttonStyles({ variant: 'ghost', size: 'icon-sm' })}
            >
              <Ellipsis size={18} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={6} className="z-30">
                <Menu.Popup className="bg-surface min-w-36 rounded-xl border border-white/10 p-1 shadow-xl">
                  <Menu.Item
                    onClick={onDelete}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 outline-none data-highlighted:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                    Удалить
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}
    </li>
  );
}
