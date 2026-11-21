import { useQuery } from '@tanstack/react-query';

import {
  type DocumentSummary,
  getDocumentDeletionImpact,
} from '@anyko/contracts/documents';
import { Button, Confirm, Notice } from '@anyko/ui';

import { callApi } from '@/lib/api/call';

import { documentKeys } from '../../api/keys';
import { describeDocumentError } from '../../model/error-texts';

import { HoldDelete } from './hold-delete';

export function ConfirmDocumentDeletion({
  deleting,
  workspaceId,
  visible,
  pending,
  onConfirm,
  onCancel,
}: {
  deleting: DocumentSummary[];
  workspaceId: string;
  visible: ReadonlySet<string>;
  pending: boolean;
  onConfirm: (tokens: ReadonlyMap<string, string>) => void;
  onCancel: () => void;
}) {
  const bulk = deleting.length > 1;
  const acrossPages = deleting.some(({ id }) => !visible.has(id));
  const impacts = useQuery({
    queryKey: [
      ...documentKeys.deletionImpact(workspaceId),
      deleting.map(({ id }) => id),
    ],
    enabled: deleting.length > 0 && !pending,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const items = [];
      for (let offset = 0; offset < deleting.length; offset += 4) {
        signal.throwIfAborted();
        items.push(
          ...(await Promise.all(
            deleting
              .slice(offset, offset + 4)
              .map(async ({ id, filename }) => ({
                id,
                filename,
                ...(await callApi(getDocumentDeletionImpact, {
                  params: { workspaceId, documentId: id },
                  signal,
                })),
              })),
          )),
        );
      }
      return items;
    },
  });
  const affected = impacts.data?.filter(({ works }) => works.length > 0) ?? [];
  const works = new Set(
    affected.flatMap(({ works }) => works.map(({ id }) => id)),
  );
  const forbidden = impacts.data?.some(({ canDelete }) => !canDelete);
  const busy = affected.some(({ works }) => works.some((work) => work.busy));
  const canConfirm =
    impacts.isSuccess && !impacts.isFetching && !forbidden && !busy && !pending;
  const label = bulk ? 'Удалить файлы' : 'Удалить документ';
  const confirm = () => {
    if (canConfirm)
      onConfirm(new Map(impacts.data.map(({ id, token }) => [id, token])));
  };
  return (
    <Confirm
      open={deleting.length > 0}
      title={
        bulk
          ? `Удалить выбранные файлы (${String(deleting.length)})?`
          : `Удалить «${deleting[0]?.filename ?? ''}»?`
      }
      confirmLabel={label}
      pending={pending}
      onConfirm={confirm}
      onCancel={onCancel}
      confirmAction={
        affected.length && canConfirm ? (
          <HoldDelete
            key={impacts.data.map(({ token }) => token).join(':')}
            label={label}
            onConfirm={confirm}
          />
        ) : !canConfirm ? (
          <Button variant="danger" disabled loading={pending}>
            {label}
          </Button>
        ) : undefined
      }
      details={
        <div className="mt-4 grid gap-3">
          {impacts.isPending && (
            <p role="status" className="text-muted text-sm">
              Проверяем связи с работами…
            </p>
          )}
          {impacts.error && (
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void impacts.refetch();
                  }}
                >
                  Обновить
                </Button>
              }
            >
              {describeDocumentError(impacts.error)}
            </Notice>
          )}
          {affected.length > 0 && (
            <>
              <p className="text-sm font-medium">
                Затронуто работ: {works.size}
              </p>
              <ul
                className="grid max-h-36 gap-2 overflow-y-auto text-sm"
                aria-label="Затронутые работы"
              >
                {affected.map(({ id, works, filename }) => (
                  <li key={id}>
                    {bulk && <p className="text-muted">{filename}</p>}
                    <ul className="grid gap-1">
                      {works.map((work) => (
                        <li key={work.id}>
                          {work.title}
                          {work.busy && ' · идёт обработка'}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="text-muted text-sm">
                Работы потеряют этот источник. Значения без доказательств
                сохранятся для проверки. Сформированные DOCX останутся в
                истории.
              </p>
            </>
          )}
          {forbidden && (
            <Notice tone="warning">
              Файл, связанный с работой, может удалить только владелец области.
            </Notice>
          )}
          {busy && (
            <Notice tone="warning">
              Дождитесь завершения анализа или формирования документов в
              затронутых работах.
            </Notice>
          )}
        </div>
      }
    >
      Оригиналы и результаты распознавания будут удалены без возможности
      восстановления.
      {acrossPages && ' Выбор включает файлы за пределами текущей страницы.'}
    </Confirm>
  );
}
