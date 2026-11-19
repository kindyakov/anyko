'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';

import type {
  AgentHistoryPage,
  AgentHistoryRunPage,
  WorkView,
} from '@anyko/contracts/works';
import { Button, Disclosure, Modal } from '@anyko/ui';

import { agentHistoryQuery, analysisRunsQuery } from '../api/queries';

import { HistoryError, HistoryPagination } from './history-controls';

type Run = AgentHistoryRunPage['items'][number];
const stages: Record<string, string> = {
  vision: 'Описание вложенного изображения',
  extraction: 'Поиск сведений',
  reconciliation: 'Сопоставление',
};
const statuses: Record<string, string> = {
  running: 'Исход пока неизвестен',
  responded: 'Ответ получен',
  failed: 'Ошибка запроса',
  succeeded: 'Вызов инструмента выполнен',
  accepted: 'Результат сохранён',
  rejected: 'Результат отклонён',
  superseded: 'Устаревшая попытка',
};
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

function RunHistory({
  workspaceId,
  view,
  run,
}: {
  workspaceId: string;
  view: WorkView;
  run: Run;
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
  if (error) return <HistoryError error={error} retry={refetch} />;
  if (isPending) return <p role="status">Загружаем историю…</p>;
  const documentName = (id: string | null) =>
    view.documents.find((document) => document.id === id)?.filename;
  return (
    <div className="grid gap-3 text-sm">
      <Usage title="Вся работа" usage={data.workUsage} />
      <Usage title="Выбранный запуск" usage={data.runUsage} />
      {data.steps.length > 0 && (
        <Disclosure title="Расход по этапам">
          <div className="grid gap-2">
            {data.steps.map((step) => (
              <Usage
                key={`${step.stage}:${step.documentId ?? ''}`}
                usage={step.usage}
                title={[
                  stages[step.stage] ?? step.stage,
                  documentName(step.documentId),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        </Disclosure>
      )}
      {data.total === 0 && (
        <p className="text-muted">Для запуска пока нет сохранённых событий.</p>
      )}
      {data.items.map((event) => (
        <Disclosure
          key={event.id}
          className="border-line rounded-xl border px-3"
          title={[
            stages[event.stage] ?? event.stage,
            documentName(event.documentId),
            statuses[event.status] ?? event.status,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <p className="text-muted">
            {new Date(event.createdAt).toLocaleString('ru-RU')}
          </p>
          {event.model && (
            <p className="wrap-anywhere">
              {event.provider} / {event.model}
            </p>
          )}
          {event.kind === 'provider' && (
            <p className="text-muted">
              Вход {event.inputTokens ?? 'неизвестно'} · Выход{' '}
              {event.outputTokens ?? 'неизвестно'}
            </p>
          )}
          {event.errorCode && <p className="text-muted">{event.errorCode}</p>}
          {event.input && (
            <Payload
              title={
                event.kind === 'tool' ? 'Вызов инструмента' : 'Вход модели'
              }
              value={event.input}
            />
          )}
          {event.output && (
            <Payload
              title={
                event.kind === 'decision'
                  ? 'Решение по предложениям'
                  : event.kind === 'tool'
                    ? 'Результат инструмента'
                    : 'Ответ модели'
              }
              value={event.output}
            />
          )}
        </Disclosure>
      ))}
      <HistoryPagination
        page={page}
        pages={Math.ceil(data.total / data.pageSize)}
        onPage={setPage}
      />
    </div>
  );
}

function Payload({ title, value }: { title: string; value: string }) {
  return (
    <div className="mt-3">
      <h4 className="font-medium">{title}</h4>
      <pre className="bg-canvas mt-1 max-h-72 overflow-auto rounded-lg p-2 text-xs wrap-anywhere whitespace-pre-wrap">
        {JSON.stringify(JSON.parse(value), null, 2)}
      </pre>
    </div>
  );
}

function Usage({
  title,
  usage,
}: {
  title: string;
  usage: AgentHistoryPage['runUsage'];
}) {
  return (
    <div className="border-line rounded-xl border p-3">
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted">
        {usage.calls} вызовов · Вход {usage.inputTokens ?? '—'} · Выход{' '}
        {usage.outputTokens ?? '—'}
      </p>
      {(usage.unknownInputCalls > 0 || usage.unknownOutputCalls > 0) && (
        <p className="text-muted">
          Расход неизвестен · Вход {usage.unknownInputCalls} · Выход{' '}
          {usage.unknownOutputCalls}
        </p>
      )}
      {usage.cachedInputTokens !== null && (
        <p className="text-muted">Из кэша {usage.cachedInputTokens}</p>
      )}
      {usage.reasoningTokens !== null && (
        <p className="text-muted">Токены рассуждения {usage.reasoningTokens}</p>
      )}
    </div>
  );
}
