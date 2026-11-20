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
    <div className="mt-3 grid gap-3">
      <dl className="border-line grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted">Прежнее значение</dt>
          <dd>
            <HistoryValue value={change.before} field={field} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Новое значение</dt>
          <dd>
            <HistoryValue value={change.after} field={field} />
          </dd>
        </div>
      </dl>
      {canEdit && field && (
        <Button
          variant="secondary"
          size="sm"
          className="justify-self-start"
          disabled={restore.isPending}
          onClick={() => {
            restore.mutate(revision);
          }}
        >
          {restore.isPending
            ? 'Восстанавливаем…'
            : 'Восстановить прежнее значение'}
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
