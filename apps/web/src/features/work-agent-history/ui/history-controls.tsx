import { RotateCw } from 'lucide-react';

import { Button, Notice } from '@anyko/ui';

import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export function HistoryError({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<unknown>;
}) {
  return (
    <Notice
      tone="danger"
      role="alert"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void retry();
          }}
        >
          <RotateCw size={14} />
          Повторить
        </Button>
      }
    >
      {describeApiError(error, {
        codes: {
          FORBIDDEN: sharedCodeTexts.FORBIDDEN,
          NOT_FOUND: 'История работы недоступна.',
          CLEANUP_PENDING: 'История недоступна во время удаления источника.',
          INVALID_WORK_INPUT: 'Неверный запрос истории.',
        },
      })}
    </Notice>
  );
}
