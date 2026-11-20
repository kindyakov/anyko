import { Tabs } from '@base-ui/react/tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChartNoAxesColumn, Wrench } from 'lucide-react';
import { useState } from 'react';

import type { AgentHistoryRunPage, WorkView } from '@anyko/contracts/works';
import { Disclosure } from '@anyko/ui';
import { Trace, TraceStep } from '@anyko/ui/chat';

import { agentHistoryQuery } from '../api/queries';

import { FieldChange } from './field-change';
import { HistoryError, HistoryPagination } from './history-controls';
import { Usage } from './usage';

type Run = AgentHistoryRunPage['items'][number];
const stages: Record<string, string> = {
  vision: 'Описание вложенного изображения',
  extraction: 'Поиск сведений',
  reconciliation: 'Сопоставление',
  chat: 'Диалог с агентом',
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
const tabStyles =
  'text-muted data-[active]:text-ink data-[active]:border-brand-hot focus-visible:outline-brand-hot flex min-h-10 items-center gap-2 border-b-2 border-transparent px-1 text-sm font-medium focus-visible:outline-2';

export function RunHistory({
  workspaceId,
  view,
  run,
  presentation = 'history',
  errorCode = null,
}: {
  workspaceId: string;
  view: WorkView;
  run: Run;
  presentation?: 'history' | 'chat';
  errorCode?: string | null;
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
  const fields = new Map(
    view.package.fields.map((field) => [field.key, field]),
  );
  const usage = (
    <>
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
    </>
  );
  const history = (
    <>
      {data.total === 0 && (
        <p className="text-muted">Для запуска пока нет сохранённых событий.</p>
      )}
      {data.items.map((event) => {
        const change = event.fieldChange;
        const field = change ? fields.get(change.field) : undefined;
        const title = [
          stages[event.stage] ?? event.stage,
          documentName(event.documentId),
          statuses[event.status] ?? event.status,
          change ? (field?.label ?? change.field) : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
        const payload = (event.input || event.output) && (
          <>
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
          </>
        );
        const details = (
          <>
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
            {change && (
              <FieldChange
                change={change}
                field={field}
                workspaceId={workspaceId}
                workId={view.work.id}
                runId={run.id}
                eventId={event.id}
                revision={view.work.revision}
              />
            )}
            {payload &&
              (presentation === 'chat' && change ? (
                <Disclosure title="Данные вызова">{payload}</Disclosure>
              ) : (
                payload
              ))}
          </>
        );
        return presentation === 'chat' ? (
          <TraceStep
            key={event.id}
            icon={
              event.kind === 'tool' ? (
                <Wrench size={14} />
              ) : (
                <Activity size={14} />
              )
            }
            title={change ? `Поле «${field?.label ?? change.field}»` : title}
          >
            {details}
          </TraceStep>
        ) : (
          <Disclosure
            key={event.id}
            className="border-line rounded-xl border px-3"
            title={title}
          >
            {details}
          </Disclosure>
        );
      })}
      <HistoryPagination
        page={page}
        pages={Math.ceil(data.total / data.pageSize)}
        onPage={setPage}
      />
    </>
  );
  return presentation === 'chat' ? (
    <Tabs.Root defaultValue="events" className="grid gap-4">
      <Tabs.List
        aria-label="Подробности запуска"
        className="border-line flex gap-5 border-b"
      >
        <Tabs.Tab value="events" className={tabStyles}>
          <Activity size={15} aria-hidden />
          События
        </Tabs.Tab>
        <Tabs.Tab value="usage" className={tabStyles}>
          <ChartNoAxesColumn size={15} aria-hidden />
          Расход токенов
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="events" className="min-w-0">
        {errorCode && (
          <p className="text-muted mb-3 text-xs">Код ошибки {errorCode}</p>
        )}
        <Trace>{history}</Trace>
      </Tabs.Panel>
      <Tabs.Panel value="usage" className="min-w-0">
        <div className="grid gap-3 text-sm">{usage}</div>
      </Tabs.Panel>
    </Tabs.Root>
  ) : (
    <div className="grid gap-3 text-sm">
      {usage}
      {history}
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
