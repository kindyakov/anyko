import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { WorkPage } from '@anyko/contracts/works';
import { Confirm, Notice, useToast } from '@anyko/ui';

import { useDeleteWork } from '@/features/works/api/mutations';
import { workDeletionQueryOptions } from '@/features/works/api/queries';
import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

type Work = WorkPage['items'][number];

export function WorkDeletionDialog({
  workspaceId,
  target,
  pending,
  onClose,
}: {
  workspaceId: string;
  target: Work | undefined;
  pending: WorkPage['deletions'];
  onClose: () => void;
}) {
  const [last, setLast] = useState<Work>();
  const announced = useRef<string>(undefined);
  const { add } = useToast();
  const action = useDeleteWork(workspaceId);
  const status = useQuery(workDeletionQueryOptions(workspaceId, last?.id)).data
    ?.status;
  useEffect(() => {
    if (!last || status !== 'deleted' || announced.current === last.id) return;
    announced.current = last.id;
    add({
      variant: 'success',
      title: `Работа «${last.title}» и её файлы удалены.`,
    });
  }, [add, last, status]);
  const needsRecovery =
    status === 'needs-recovery' ||
    pending.some((item) => item.status === 'needs-recovery');
  return (
    <>
      {(pending.length > 0 || status === 'deleting' || needsRecovery) && (
        <div className="mb-4">
          {needsRecovery ? (
            <Notice role="status" tone="warning">
              Удаление ещё не завершено. Система повторяет очистку данных и
              файлов.
            </Notice>
          ) : (
            <Notice role="status" tone="progress">
              Удаляем работы и их файлы.
            </Notice>
          )}
        </div>
      )}
      <Confirm
        open={target !== undefined}
        title={`Удалить работу «${target?.title ?? ''}»?`}
        confirmLabel="Удалить работу"
        pending={action.isPending}
        onConfirm={() => {
          if (!target) return;
          action.mutate(target.id, {
            onSuccess: () => {
              setLast(target);
              onClose();
            },
          });
        }}
        onCancel={() => {
          action.reset();
          onClose();
        }}
      >
        Сведения, переписка агента и готовые документы этой работы будут удалены
        без возможности восстановления. Исходные файлы сохранятся в каталоге.
        {action.error && (
          <span role="alert" className="mt-3 block text-red-300">
            {describeApiError(action.error, {
              codes: sharedCodeTexts,
              fallback: 'Не удалось начать удаление работы.',
            })}
          </span>
        )}
      </Confirm>
    </>
  );
}
