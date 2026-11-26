import {
  Activity,
  AlertTriangle,
  Bot,
  ListChecks,
  PencilLine,
  Wrench,
} from 'lucide-react';

import type { AgentHistoryPage, WorkView } from '@anyko/contracts/works';
import { Disclosure } from '@anyko/ui';
import { TraceStep } from '@anyko/ui/chat';

import { errorText } from '@/features/works';

import { FieldChange } from './field-change';

type Event = AgentHistoryPage['items'][number];

export const stageLabels: Record<string, string> = {
  vision: 'Описание изображения',
  extraction: 'Поиск сведений',
  reconciliation: 'Сопоставление',
  chat: 'Диалог с агентом',
};
const statusLabels: Record<string, string> = {
  running: 'Исход пока неизвестен',
  responded: 'Ответ получен',
  failed: 'Ошибка запроса',
  succeeded: 'Вызов инструмента выполнен',
  accepted: 'Результат сохранён',
  rejected: 'Результат отклонён',
  superseded: 'Устаревшая попытка',
};
const time = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const number = new Intl.NumberFormat('ru-RU');

function checklistAction({
  before,
  after,
}: NonNullable<Event['checklistChange']>) {
  if (after === 'confirmed')
    return before === after ? 'Отметка уже стоит' : 'Отметка поставлена';
  return before === after ? 'Отметка уже снята' : 'Отметка снята';
}

/** Одно событие запуска: суть — словами, технические данные — в свёрнутом разделе. */
export function RunEvent({
  event,
  view,
  workspaceId,
  runId,
}: {
  event: Event;
  view: WorkView;
  workspaceId: string;
  runId: string;
}) {
  const change = event.fieldChange;
  const checklist = event.checklistChange;
  const field = change
    ? view.package.fields.find(({ key }) => key === change.field)
    : undefined;
  const failed = event.status === 'failed' || event.errorCode !== null;
  const stage = stageLabels[event.stage] ?? event.stage;
  const title = change
    ? `Изменено поле «${field?.label ?? change.field}»`
    : checklist
      ? `${checklistAction(checklist)} · ${checklist.requirementLabel}`
      : `${stage} · ${statusLabels[event.status] ?? event.status}`;
  const filename =
    checklist?.filename ??
    view.documents.find(({ id }) => id === event.documentId)?.filename;
  const Icon = failed
    ? AlertTriangle
    : change
      ? PencilLine
      : checklist
        ? ListChecks
        : event.kind === 'tool'
          ? Wrench
          : event.kind === 'provider'
            ? Bot
            : Activity;
  const technical = <TechnicalDetails event={event} />;
  const summary = change || checklist || event.errorCode;
  return (
    <TraceStep
      icon={
        <Icon
          size={14}
          className={
            failed ? 'text-red-300' : change ? 'text-brand-hot' : undefined
          }
        />
      }
      title={
        <span className="flex flex-col">
          <span
            className={change || checklist ? 'text-ink font-medium' : undefined}
          >
            {title}
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums">
            {[time.format(new Date(event.createdAt)), change && stage, filename]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      }
    >
      {summary ? (
        <div className="grid gap-2 text-sm">
          {event.errorCode && (
            <p className="text-red-300">{errorText(event.errorCode)}</p>
          )}
          {change && (
            <FieldChange
              change={change}
              field={field}
              workspaceId={workspaceId}
              workId={view.work.id}
              runId={runId}
              eventId={event.id}
              revision={view.work.revision}
            />
          )}
          {checklist && (
            <p className="text-muted">
              {checklistAction(checklist)} в чек-листе для файла{' '}
              <span className="text-ink">{checklist.filename}</span>.
            </p>
          )}
          <Disclosure title="Технические подробности">{technical}</Disclosure>
        </div>
      ) : (
        technical
      )}
    </TraceStep>
  );
}

function TechnicalDetails({ event }: { event: Event }) {
  const rows = [
    ['Время', new Date(event.createdAt).toLocaleString('ru-RU')],
    event.model && ['Модель', `${event.provider ?? ''} / ${event.model}`],
    event.kind === 'provider' && [
      'Токены',
      `вход ${event.inputTokens === null ? '—' : number.format(event.inputTokens)} · выход ${event.outputTokens === null ? '—' : number.format(event.outputTokens)}`,
    ],
    event.durationMs !== null && [
      'Длительность',
      `${(event.durationMs / 1000).toFixed(1)} с`,
    ],
    event.errorCode && ['Код', event.errorCode],
  ].filter((row): row is [string, string] => Array.isArray(row));
  return (
    <div className="grid gap-3 text-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="wrap-anywhere tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {event.input && (
        <Payload
          title={event.kind === 'tool' ? 'Вызов инструмента' : 'Вход модели'}
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
    </div>
  );
}

function Payload({ title, value }: { title: string; value: string }) {
  let text = value;
  try {
    text = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // Не JSON — показываем как есть.
  }
  return (
    <div>
      <h4 className="text-muted mb-1 font-medium">{title}</h4>
      <pre className="bg-canvas/80 max-h-72 overflow-auto rounded-lg border border-white/[0.06] p-2.5 font-mono text-[11px] leading-5 wrap-anywhere whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}
