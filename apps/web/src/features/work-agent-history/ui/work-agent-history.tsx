'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';

import type { AgentHistoryRunPage, WorkView } from '@anyko/contracts/works';
import { Button, Disclosure, Modal } from '@anyko/ui';

import { analysisRunsQuery } from '../api/queries';

import { HistoryError, HistoryPagination } from './history-controls';
import { RunHistory } from './run-history';

type Run = AgentHistoryRunPage['items'][number];
const runStatuses: Record<Run['status'], string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Готово',
  partial: 'Готово частично',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

export function WorkAgentHistory({
  workspaceId,
  view,
}: {
  workspaceId: string;
  view: WorkView;
}) {
  const [open, setOpen] = useState(false);
  if (view.cleanupPending) return null;
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        <History size={16} />
        История анализа
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="История анализа"
        size="sheet"
      >
        {open && <AnalysisRuns workspaceId={workspaceId} view={view} />}
      </Modal>
    </>
  );
}

function AnalysisRuns({
  workspaceId,
  view,
}: {
  workspaceId: string;
  view: WorkView;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
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
  if (isPending) return <p role="status">Загружаем запуски…</p>;
  const run = data.items.find(({ id }) => id === selected) ?? data.items[0];
  if (!run)
    return (
      <p className="text-muted">В работе пока не было запусков анализа.</p>
    );
  return (
    <div className="grid gap-4">
      <Disclosure title="Запуски анализа">
        <ul className="grid gap-1">
          {data.items.map((entry) => (
            <li key={entry.id}>
              <Button
                variant={entry.id === run.id ? 'secondary' : 'ghost'}
                aria-pressed={entry.id === run.id}
                onClick={() => {
                  setSelected(entry.id);
                }}
              >
                {new Date(entry.createdAt).toLocaleString('ru-RU')} ·{' '}
                {runStatuses[entry.status]}
              </Button>
            </li>
          ))}
        </ul>
        <HistoryPagination
          page={page}
          pages={Math.ceil(data.total / data.pageSize)}
          onPage={setPage}
        />
      </Disclosure>
      <RunHistory
        key={run.id}
        workspaceId={workspaceId}
        view={view}
        run={run}
      />
    </div>
  );
}
