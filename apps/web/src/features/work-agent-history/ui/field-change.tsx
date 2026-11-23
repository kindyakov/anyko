import { Undo2 } from 'lucide-react';

import type { FieldValue } from '@anyko/contracts/catalog';
import type { AgentHistoryPage, WorkView } from '@anyko/contracts/works';
import { Button, Notice } from '@anyko/ui';

import { useCan } from '@/lib/api/workspace';

import { useRestoreField } from '../api/restore-field';
import { describeFieldRestoreError } from '../model/restore-error';

type Field = WorkView['package']['fields'][number];
type Change = NonNullable<AgentHistoryPage['items'][number]['fieldChange']>;

export function FieldChange({
  change,
  field,
  workspaceId,
  workId,
  runId,
  eventId,
  revision,
}: {
  change: Change;
  field: Field | undefined;
  workspaceId: string;
  workId: string;
  runId: string;
  eventId: string;
  revision: number;
}) {
  const canEdit = useCan('works.edit');
  const restore = useRestoreField(workspaceId, workId, runId, eventId);
  return (
    <div className="grid gap-2.5">
      <dl className="grid gap-1.5">
        <div className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
          <dt className="text-muted text-[11px] font-medium">
            Прежнее значение
          </dt>
          <dd className="text-muted mt-0.5">
            <HistoryValue value={change.before} field={field} />
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2">
          <dt className="text-[11px] font-medium text-emerald-300">
            Новое значение
          </dt>
          <dd className="text-ink mt-0.5">
            <HistoryValue value={change.after} field={field} />
          </dd>
        </div>
      </dl>
      {canEdit && field && (
        <Button
          variant="secondary"
          size="sm"
          className="justify-self-start"
          loading={restore.isPending}
          onClick={() => {
            restore.mutate(revision);
          }}
        >
          <Undo2 size={14} />
          Восстановить прежнее значение
        </Button>
      )}
      {restore.error && (
        <Notice tone="danger" role="alert">
          {describeFieldRestoreError(restore.error)}
        </Notice>
      )}
      {restore.isSuccess && (
        <Notice tone="success" role="status">
          Значение поля восстановлено.
        </Notice>
      )}
    </div>
  );
}

function HistoryValue({
  value,
  field,
}: {
  value: FieldValue;
  field: Field | undefined;
}) {
  if (value === null) return <span className="text-muted">Не заполнено</span>;
  if (typeof value === 'string')
    return <span className="wrap-anywhere whitespace-pre-wrap">{value}</span>;
  if (!value.length) return <span className="text-muted">Записей нет</span>;
  return (
    <ol className="ml-4 grid list-decimal gap-2">
      {value.map((row, index) => (
        <li key={index}>
          <dl className="grid gap-1">
            {Object.entries(row).map(([key, cell]) => (
              <div key={key} className="wrap-anywhere">
                <dt className="text-muted">
                  {field?.columns.find((column) => column.key === key)?.label ??
                    key}
                </dt>
                <dd className="whitespace-pre-wrap">
                  {cell ?? 'Не заполнено'}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
