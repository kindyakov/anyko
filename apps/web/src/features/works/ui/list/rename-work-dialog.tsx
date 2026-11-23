'use client';

import { useRef, useState } from 'react';

import { Button, Modal, Notice } from '@anyko/ui';

import { useRenameWork } from '@/features/works/api/mutations';
import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';

export function RenameWorkDialog({
  workspaceId,
  work,
  onClose,
}: {
  workspaceId: string;
  work: { id: string; title: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(work.title);
  const input = useRef<HTMLInputElement>(null);
  const rename = useRenameWork(workspaceId);
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Переименовать работу"
      initialFocus={input}
      dismissible={!rename.isPending}
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          rename.mutate(
            { workId: work.id, title: title.trim() },
            { onSuccess: onClose },
          );
        }}
      >
        <label className="grid gap-2 text-sm font-medium">
          Название работы
          <input
            ref={input}
            required
            maxLength={200}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-base outline-none focus:border-rose-500"
          />
        </label>
        {rename.error && (
          <Notice tone="danger" role="alert">
            {describeApiError(rename.error, {
              codes: sharedCodeTexts,
              fallback: 'Не удалось переименовать работу. Попробуйте снова.',
            })}
          </Notice>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={rename.isPending}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            loading={rename.isPending}
            disabled={!title.trim() || title.trim() === work.title}
          >
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
