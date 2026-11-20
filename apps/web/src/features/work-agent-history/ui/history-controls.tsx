import { Button, Notice } from '@anyko/ui';

import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export function HistoryPagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages < 2) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button
        variant="ghost"
        disabled={page === 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        Назад
      </Button>
      <span>
        Страница {page} из {pages}
      </span>
      <Button
        variant="ghost"
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        Дальше
      </Button>
    </div>
  );
}

export function HistoryError({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<unknown>;
}) {
  return (
    <Notice tone="danger" role="alert">
      {describeApiError(error, {
        codes: {
          FORBIDDEN: sharedCodeTexts.FORBIDDEN,
          NOT_FOUND: 'История работы недоступна.',
          CLEANUP_PENDING: 'История недоступна во время удаления источника.',
          INVALID_WORK_INPUT: 'Неверный запрос истории.',
        },
      })}
      <Button
        variant="ghost"
        onClick={() => {
          void retry();
        }}
      >
        Повторить
      </Button>
    </Notice>
  );
}
