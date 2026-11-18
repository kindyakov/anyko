import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button, Modal, Notice } from '@anyko/ui';

import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';

import { useUpdateWorkDocumentRecognition } from '../api/commands';

export function OcrRevisionAction({
  workId,
  documentId,
  filename,
  current,
  latest,
  disabled,
}: {
  workId: string;
  documentId: string;
  filename: string;
  current: number;
  latest: number;
  disabled: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const canUpdate = useCan('works.edit');
  const update = useUpdateWorkDocumentRecognition(workspaceId, workId);
  const [target, setTarget] = useState<number>();
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
      <p className="text-muted text-xs">Версия распознавания {current}</p>
      {latest > current &&
        (canUpdate ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              update.reset();
              setTarget(latest);
            }}
          >
            <RefreshCw size={14} aria-hidden />
            Обновить до версии {latest}
          </Button>
        ) : (
          <span className="text-muted text-xs">Доступна версия {latest}</span>
        ))}
      {target !== undefined && (
        <Modal
          open
          title="Обновить распознавание?"
          description={`В этой работе «${filename}» будет использовать версию ${String(target)}.`}
          dismissible={!update.isPending}
          onOpenChange={(open) => {
            if (!open) setTarget(undefined);
          }}
        >
          <p className="text-muted text-sm">
            Значения сохранятся. Сведения без доступных доказательств нужно
            будет проверить. Извлечение запускается отдельно.
          </p>
          {update.error && (
            <div className="mt-4">
              <Notice tone="danger" role="alert">
                {describeApiError(update.error, {
                  codes: {
                    ...sharedCodeTexts,
                    WORK_BUSY:
                      'Дождитесь завершения обработки работы и повторите.',
                    NOT_READY:
                      'Результат этой версии недоступен. Обновите работу и попробуйте снова.',
                  },
                  fallback:
                    'Не удалось обновить распознавание. Попробуйте снова.',
                })}
              </Notice>
            </div>
          )}
          <footer className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={update.isPending}
              onClick={() => {
                setTarget(undefined);
              }}
            >
              Отмена
            </Button>
            <Button
              loading={update.isPending}
              onClick={() => {
                update.mutate(
                  { documentId, ocrRevision: target },
                  {
                    onSuccess: () => {
                      setTarget(undefined);
                    },
                  },
                );
              }}
            >
              Обновить распознавание
            </Button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
