import { ArrowUpRight, FileStack } from 'lucide-react';
import Link from 'next/link';

import type { DocumentPackage } from '@anyko/contracts/catalog';
import type { WorkPage } from '@anyko/contracts/works';
import { HoverMist, RelativeTime, stagger, StatusPill } from '@anyko/ui';

import { routes } from '@/lib/routes';

export function WorkCard({
  work,
  index,
  packages,
  workspaceId,
}: {
  work: WorkPage['works'][number];
  index: number;
  packages: readonly DocumentPackage[];
  workspaceId: string;
}) {
  const confirmed = work.confirmedRevision === work.revision;
  const pack = packages.find((item) => item.version === work.packageVersion);
  return (
    <li className={`animate-rise ${stagger(index)}`}>
      <Link
        href={routes.work(workspaceId, work.id)}
        className="group group/mist focus-visible:outline-brand-hot glass relative isolate flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] p-6 transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/40 hover:shadow-[0_20px_60px_-20px_#db143c88] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <HoverMist />
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors duration-300 group-hover:border-[#ff3b62]/40 group-hover:text-[#ff6a88]">
            <FileStack size={20} strokeWidth={1.6} />
          </span>
          <ArrowUpRight
            size={20}
            className="text-muted transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
          />
        </div>
        <h2 className="font-heading mt-6 text-lg leading-snug font-bold tracking-tight wrap-anywhere">
          {work.title}
        </h2>
        <p className="text-muted mt-1.5 text-sm leading-6 wrap-anywhere">
          {pack?.title ?? 'Комплект документов'}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-7">
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
    </li>
  );
}
