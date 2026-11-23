import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import {
  Button,
  Checkbox,
  Confirm,
  HoldButton,
  Notice,
  Spinner,
} from '@anyko/ui';

import { liveQuery } from '@/lib/api/live-query';

import { readDeletionImpacts } from '../../api/commands';
import { documentKeys } from '../../api/keys';
import { describeDocumentError } from '../../model/error-texts';

import { DeletionImpact } from './deletion-impact';

const acknowledgement = 'Подтверждаю удаление из перечисленных работ';

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
    meta: liveQuery(workspaceId, 'work-list'),
    queryKey: [
      ...documentKeys.deletionImpact(workspaceId),
      deleting.map(({ id }) => id),
    ],
    enabled: deleting.length > 0 && !pending,
    staleTime: 0,
    queryFn: ({ signal }) => readDeletionImpacts(workspaceId, deleting, signal),
  });
  // Подтверждение действует только для показанного списка связей: новый список требует нового согласия.
  const tokens = impacts.data?.map(({ token }) => token).join(':') ?? '';
  const [accepted, setAccepted] = useState<string | null>(null);
  const affected = impacts.data?.filter(({ works }) => works.length > 0) ?? [];
  const forbidden = impacts.data?.some(({ canDelete }) => !canDelete);
  const busy = affected.some(({ works }) => works.some((work) => work.busy));
  const canConfirm =
    impacts.isSuccess && !impacts.isFetching && !forbidden && !busy && !pending;
  const guarded = affected.length > 0 && canConfirm;
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
        guarded && accepted !== tokens ? (
          <HoldButton
            key={tokens}
            className="sm:min-w-64"
            progressLabel="Прогресс подтверждения удаления"
            icon={<Trash2 size={16} />}
            onComplete={confirm}
          >
            Удерживайте, чтобы удалить
          </HoldButton>
        ) : !canConfirm || guarded ? (
          <Button
            variant="danger"
            className="sm:min-w-64"
            disabled={!canConfirm}
            loading={pending}
            onClick={confirm}
          >
            <Trash2 size={16} />
            {label}
          </Button>
        ) : undefined
      }
      details={
        <div className="mt-5 grid gap-4">
          {impacts.isPending && (
            <p
              role="status"
              className="text-muted flex items-center gap-2.5 text-sm"
            >
              <Spinner className="size-4" />
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
            <DeletionImpact affected={affected} grouped={bulk} />
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
          {guarded && (
            <Checkbox
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/15 has-data-checked:border-red-400/30 has-data-checked:bg-red-500/[0.05]"
              checked={accepted === tokens}
              onCheckedChange={(checked) => {
                setAccepted(checked ? tokens : null);
              }}
            >
              {acknowledgement}
              <span className="text-muted block text-xs leading-5">
                Вместо удержания кнопки
              </span>
            </Checkbox>
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
