'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, History } from 'lucide-react';
import { useState } from 'react';

import type { AgentHistoryRunPage, WorkView } from '@anyko/contracts/works';
import {
  Pager,
  RelativeTime,
  Skeleton,
  StatusPill,
  type Tone,
} from '@anyko/ui';

import { analysisRunsQuery } from '../api/queries';

import { HistoryError } from './history-controls';

export type HistoryRun = AgentHistoryRunPage['items'][number];

export const runStatuses: Record<
  HistoryRun['status'],
  { text: string; tone: Tone }
> = {
  queued: { text: 'В очереди', tone: 'progress' },
  running: { text: 'Выполняется', tone: 'progress' },
  succeeded: { text: 'Готово', tone: 'success' },
  partial: { text: 'Частично', tone: 'warning' },
  failed: { text: 'Ошибка', tone: 'danger' },
  cancelled: { text: 'Отменено', tone: 'neutral' },
};

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Журнал запусков анализа: открывает выбранный запуск в подробностях. */
export function AnalysisJournal({
  workspaceId,
  view,
  onOpen,
}: {
  workspaceId: string;
  view: WorkView;
  onOpen: (run: HistoryRun) => void;
}) {
  const [page, setPage] = useState(1);
  const latestRunId =
    view.runs.find(({ kind }) => kind === 'analysis')?.id ?? null;
  const active = view.runs.some(
    ({ kind, status }) =>
      kind === 'analysis' && (status === 'queued' || status === 'running'),
  );
  const { data, error, isPending, refetch } = useQuery(
    analysisRunsQuery(workspaceId, view.work.id, page, active, latestRunId),
  );
  if (error) return <HistoryError error={error} retry={refetch} />;
  if (isPending)
    return (
      <div aria-busy className="grid gap-2">
        <span role="status" className="sr-only">
          Загружаем запуски
        </span>
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  if (!data.items.length)
    return (
      <div className="m-auto max-w-64 py-10 text-center">
        <span className="text-muted mx-auto mb-3 grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <History size={20} aria-hidden />
        </span>
        <p className="font-semibold">Запусков пока не было</p>
        <p className="text-muted mt-1.5 text-sm leading-6">
          Здесь появится история извлечения сведений из файлов.
        </p>
      </div>
    );
  const pages = Math.ceil(data.total / data.pageSize);
  return (
    <div className="grid gap-4">
      <ul aria-label="Запуски анализа" className="grid gap-1.5">
        {data.items.map((run, index) => {
          const status = runStatuses[run.status];
          const latest = page === 1 && index === 0;
          return (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(run);
                }}
                className="group focus-visible:outline-brand-hot flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    Автоматический анализ
                    {latest && (
                      <span className="text-muted rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                        последний
                      </span>
                    )}
                  </span>
                  <span className="text-muted mt-0.5 block text-xs tabular-nums">
                    {dateFormat.format(new Date(run.createdAt))} ·{' '}
                    <RelativeTime value={run.createdAt} />
                  </span>
                </span>
                <StatusPill tone={status.tone}>{status.text}</StatusPill>
                <ChevronRight
                  size={16}
                  aria-hidden
                  className="text-muted shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-center">
        <Pager
          label="Страницы запусков"
          page={page}
          pages={pages}
          onPage={setPage}
        />
      </div>
    </div>
  );
}
