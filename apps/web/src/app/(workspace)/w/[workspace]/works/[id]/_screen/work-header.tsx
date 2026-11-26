'use client';
import {
  ChevronRight,
  ClipboardList,
  PencilLine,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import { ActionMenu, Button, StatusPill } from '@anyko/ui';

import { RenameWorkDialog, type useWorkView } from '@/features/works';
import { useCan } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

type Live = ReturnType<typeof useWorkView>['live'];

/** Шапка работы: путь, название, статус и инструменты — помощник и редкие действия. */
export function WorkHeader({
  workspaceId,
  view,
  live,
  agentOpen,
  agentBusy,
  onAgent,
  onChecklist,
}: {
  workspaceId: string;
  view: WorkView;
  live: Live;
  agentOpen: boolean;
  agentBusy: boolean;
  onAgent: () => void;
  /** Есть, когда колонки чек-листа не видно: узкий экран или открыт агент. */
  onChecklist: (() => void) | undefined;
}) {
  const canEdit = useCan('works.edit');
  const [renaming, setRenaming] = useState(false);
  const confirmed = view.work.confirmedRevision === view.work.revision;
  return (
    <header className="animate-rise mb-6">
      <nav
        aria-label="Путь"
        className="text-muted flex items-center gap-1 text-sm"
      >
        <Link
          href={routes.works(workspaceId)}
          className="hover:text-ink transition-colors"
        >
          Работы
        </Link>
        <ChevronRight size={14} aria-hidden className="text-zinc-600" />
        <span aria-current="page" className="min-w-0 truncate text-zinc-400">
          {view.work.title}
        </span>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight wrap-anywhere sm:text-3xl">
              {view.work.title}
            </h1>
            {confirmed ? (
              <StatusPill tone="success">Подтверждена</StatusPill>
            ) : (
              <StatusPill tone="brand">В работе</StatusPill>
            )}
          </div>
          <p className="text-muted mt-1.5 text-sm">{view.package.title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {live === 'reconnecting' && (
            <span
              role="status"
              className="mr-1 flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1 text-xs text-amber-200"
            >
              <span className="animate-blink size-1.5 rounded-full bg-amber-400" />
              Переподключаемся — данные сохранены
            </span>
          )}
          {onChecklist && (
            <Button variant="secondary" onClick={onChecklist}>
              <ClipboardList size={16} aria-hidden className="text-brand-hot" />
              Чек-лист
            </Button>
          )}
          {!view.cleanupPending && (
            <Button
              variant="secondary"
              aria-pressed={agentOpen}
              onClick={onAgent}
            >
              <span className="relative">
                <Sparkles size={16} aria-hidden className="text-brand-hot" />
                {agentBusy && (
                  <span className="bg-brand-hot animate-blink absolute -top-0.5 -right-0.5 size-1.5 rounded-full shadow-[0_0_6px_#ff3b62]" />
                )}
              </span>
              Агент
            </Button>
          )}
          {canEdit && (
            <ActionMenu
              label="Действия с работой"
              items={[
                {
                  label: 'Переименовать',
                  icon: <PencilLine size={15} />,
                  onSelect: () => {
                    setRenaming(true);
                  },
                },
              ]}
            />
          )}
        </div>
      </div>
      {renaming && (
        <RenameWorkDialog
          workspaceId={workspaceId}
          work={view.work}
          onClose={() => {
            setRenaming(false);
          }}
        />
      )}
    </header>
  );
}
