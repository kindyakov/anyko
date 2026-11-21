'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { Button, FileIcon, Modal, Notice, StatusPill } from '@anyko/ui';
import { HorizonLoader } from '@anyko/ui/brand';

import { useWorkspaceEvents } from '@/lib/api/live-events';

import { findUploadMatches } from '../../api/upload-matches';
import { describeDocumentError } from '../../model/error-texts';

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium',
});
const statusText = {
  queued: 'Ожидает распознавания',
  running: 'Распознаётся',
  succeeded: 'Распознан',
  failed: 'Распознавание не завершено',
} as const;

export function UploadMatchDialog({
  workspaceId,
  filename,
  checksum,
  first,
  attached,
  onUse,
  onSeparate,
  onClose,
}: {
  workspaceId: string;
  filename: string;
  checksum: string;
  first: Awaited<ReturnType<typeof findUploadMatches>>;
  attached: ReadonlySet<string> | undefined;
  onUse: (document: DocumentSummary) => void;
  onSeparate: () => void;
  onClose: () => void;
}) {
  useWorkspaceEvents(workspaceId);
  const [cursors, setCursors] = useState<string[]>([]);
  const after = cursors.at(-1);
  const page = useQuery({
    queryKey: ['upload-matches', workspaceId, checksum, after],
    queryFn: ({ signal }) =>
      findUploadMatches(workspaceId, checksum, signal, after),
    initialData: after ? undefined : first,
    gcTime: 0,
  });
  const current = page.data;
  const next = current?.nextCursor;
  const reusable = (document: DocumentSummary) =>
    !attached || attached.has(document.id) || document.readyRevision != null;
  const [selection, setSelected] = useState<string>();
  const selected = selection ?? current?.items.find(reusable)?.id;
  const choice = current?.items.find(
    (document) => document.id === selected && reusable(document),
  );

  return (
    <Modal
      open
      title="Такой файл уже есть"
      description={`В каталоге есть файлы с тем же содержимым, что и «${filename}».`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <fieldset className="grid max-h-[42dvh] gap-2 overflow-auto">
        <legend className="sr-only">Совпадающие файлы</legend>
        {current?.items.map((document) => (
          <label
            key={document.id}
            className="has-checked:border-brand/60 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2"
          >
            <input
              type="radio"
              name="catalog-match"
              className="accent-brand-hot size-4"
              disabled={!reusable(document)}
              checked={selected === document.id}
              onChange={() => {
                setSelected(document.id);
              }}
            />
            <FileIcon filename={document.filename} />
            <span className="min-w-0 flex-1 wrap-anywhere">
              <span className="block text-sm font-medium">
                {document.filename}
              </span>
              <time
                className="text-muted text-xs"
                dateTime={document.createdAt}
              >
                {dateTime.format(new Date(document.createdAt))}
              </time>
            </span>
            <StatusPill tone="neutral">
              {attached?.has(document.id)
                ? 'Уже в работе'
                : document.readyRevision != null
                  ? 'Распознан'
                  : statusText[document.status]}
            </StatusPill>
          </label>
        ))}
      </fieldset>
      {after && page.isPending && (
        <HorizonLoader label="Загружаем совпадения" />
      )}
      {page.error && (
        <Notice role="alert" tone="danger">
          {describeDocumentError(page.error)}
        </Notice>
      )}
      {current?.items.length === 0 && (
        <p className="text-muted mt-3 text-sm">
          На этой странице больше нет совпадений.
        </p>
      )}
      {attached && current?.items.length && !current.items.some(reusable) ? (
        <p className="text-muted mt-3 text-sm">
          Для добавления в работу нужно дождаться готового распознавания.
        </p>
      ) : null}
      {(after || next) && (
        <nav aria-label="Страницы совпадений" className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!after}
            onClick={() => {
              setSelected(undefined);
              setCursors(cursors.slice(0, -1));
            }}
          >
            Назад
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!next}
            onClick={() => {
              if (!next) return;
              setSelected(undefined);
              setCursors([...cursors, next]);
            }}
          >
            Далее
          </Button>
        </nav>
      )}
      <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Пропустить файл
        </Button>
        <Button variant="secondary" onClick={onSeparate}>
          Загрузить отдельно
        </Button>
        <Button
          disabled={!choice}
          onClick={() => {
            if (choice) onUse(choice);
          }}
        >
          Использовать существующий
        </Button>
      </footer>
    </Modal>
  );
}
