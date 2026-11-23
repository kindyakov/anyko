import { Tabs } from '@base-ui/react/tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, ChartNoAxesColumn } from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import { Button, Pager, RelativeTime, Skeleton, StatusPill } from '@anyko/ui';
import { Trace } from '@anyko/ui/chat';

import { errorText } from '@/features/works';

import { agentHistoryQuery } from '../api/queries';

import { type HistoryRun, runStatuses } from './analysis-journal';
import { HistoryError } from './history-controls';
import { RunEvent, stageLabels } from './run-event';
import { StageUsage, UsageStats } from './usage';

const tabStyles =
  'text-muted data-[active]:text-ink data-[active]:border-brand-hot focus-visible:outline-brand-hot -mb-px flex min-h-10 items-center gap-2 border-b-2 border-transparent px-1 text-sm font-medium transition-colors hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2';
const panelStyles = 'min-h-0 flex-1 overflow-y-auto px-4 py-4';

/** Подробности запуска агента: события и расход, с возвратом к списку или чату. */
export function RunHistory({
  workspaceId,
  view,
  run,
  kind,
  errorCode = null,
  backLabel,
  onBack,
}: {
  workspaceId: string;
  view: WorkView;
  run: HistoryRun;
  kind: 'analysis' | 'chat';
  errorCode?: string | null;
  backLabel: string;
  onBack: () => void;
}) {
  const status = runStatuses[run.status];
  return (
    <Tabs.Root defaultValue="events" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/[0.07] px-4 pt-3">
        <Button variant="ghost" size="xs" className="-ml-2" onClick={onBack}>
          <ArrowLeft size={14} />
          {backLabel}
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-bold">
            {kind === 'analysis' ? 'Автоматический анализ' : 'Действия агента'}
          </h3>
          <StatusPill tone={status.tone}>{status.text}</StatusPill>
        </div>
        <p className="text-muted mt-1 text-xs tabular-nums">
          {new Date(run.createdAt).toLocaleString('ru-RU')} ·{' '}
          <RelativeTime value={run.createdAt} />
        </p>
        {errorCode && (
          <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-2.5 py-2 text-xs leading-5 text-red-200">
            {errorText(errorCode)}
          </p>
        )}
        <Tabs.List aria-label="Подробности запуска" className="mt-3 flex gap-5">
          <Tabs.Tab value="events" className={tabStyles}>
            <Activity size={15} aria-hidden />
            События
          </Tabs.Tab>
          <Tabs.Tab value="usage" className={tabStyles}>
            <ChartNoAxesColumn size={15} aria-hidden />
            Расход токенов
          </Tabs.Tab>
        </Tabs.List>
      </div>
      <RunContent workspaceId={workspaceId} view={view} run={run} />
    </Tabs.Root>
  );
}

function RunContent({
  workspaceId,
  view,
  run,
}: {
  workspaceId: string;
  view: WorkView;
  run: HistoryRun;
}) {
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery(
    agentHistoryQuery(
      workspaceId,
      view.work.id,
      run.id,
      page,
      run.status === 'running' || run.status === 'queued',
    ),
  );
  if (error)
    return (
      <div className={panelStyles}>
        <HistoryError error={error} retry={refetch} />
      </div>
    );
  if (isPending)
    return (
      <div aria-busy className={`${panelStyles} grid content-start gap-2`}>
        <span role="status" className="sr-only">
          Загружаем историю
        </span>
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  const documentName = (id: string | null) =>
    view.documents.find((document) => document.id === id)?.filename;
  return (
    <>
      <Tabs.Panel value="events" className={panelStyles}>
        {data.total === 0 ? (
          <p className="text-muted py-6 text-center text-sm">
            Для запуска пока нет сохранённых событий.
          </p>
        ) : (
          <Trace>
            {data.items.map((event) => (
              <RunEvent
                key={event.id}
                event={event}
                view={view}
                workspaceId={workspaceId}
                runId={run.id}
              />
            ))}
          </Trace>
        )}
        <div className="mt-4 flex justify-center empty:hidden">
          <Pager
            label="Страницы событий"
            page={page}
            pages={Math.ceil(data.total / data.pageSize)}
            onPage={setPage}
          />
        </div>
      </Tabs.Panel>
      <Tabs.Panel
        value="usage"
        className={`${panelStyles} grid content-start gap-5`}
      >
        <UsageStats title="Этот запуск" usage={data.runUsage} />
        <UsageStats title="Вся работа" usage={data.workUsage} />
        <StageUsage
          rows={data.steps.map((step) => ({
            key: `${step.stage}:${step.documentId ?? ''}`,
            title: [
              stageLabels[step.stage] ?? step.stage,
              documentName(step.documentId),
            ]
              .filter(Boolean)
              .join(' · '),
            usage: step.usage,
          }))}
        />
      </Tabs.Panel>
    </>
  );
}
