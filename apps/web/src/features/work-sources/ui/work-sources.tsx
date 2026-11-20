'use client';
import { Check, Eye, FolderOpen, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { type WorkView } from '@anyko/contracts/works';
import {
  Button,
  Confirm,
  FileIcon,
  HoverMist,
  RelativeTime,
  Spinner,
  stagger,
  StatusPill,
  type Tone,
} from '@anyko/ui';
import { DropZone } from '@anyko/ui/brand';

import {
  DocumentRetryButton,
  recognitionFailureText,
  recognitionRetryCode,
} from '@/features/document-recognition';
import type { Upload } from '@/features/works';
import { useWorkspaceId } from '@/lib/api/workspace';

import { DocumentPicker } from './document-picker';
import { OcrRevisionAction } from './ocr-revision-action';
import { SourceChecklist } from './source-checklist';

type Document = WorkView['documents'][number];

const accept = '.pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,.avif,.heif,.heic';
const labels: Record<Document['status'], [string, Tone]> = {
  queued: ['Ожидает обработки', 'neutral'],
  running: ['Распознаётся', 'progress'],
  succeeded: ['Прочитан', 'success'],
  failed: ['Не удалось прочитать', 'danger'],
};

export function WorkSources({
  view,
  disabled,
  retryDisabled,
  removing,
  uploads,
  onUpload,
  onDelete,
  onOpen,
  onRetry,
  retryingId,
}: {
  view: WorkView;
  disabled: {
    upload: boolean;
    remove: boolean;
    attach: boolean;
    updateRecognition: boolean;
  };
  retryDisabled: boolean;
  removing: boolean;
  uploads: Upload[];
  onUpload: (files: File[]) => Promise<number>;
  onDelete: (document: Document) => Promise<void>;
  onOpen: (document: Document, page?: number) => void;
  onRetry: (documentId: string) => void;
  retryingId: string | undefined;
}) {
  const workspaceId = useWorkspaceId();
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState<Document>();
  const uploading = uploads.some((item) => item.state === 'uploading');
  return (
    <div className="grid grid-cols-1 gap-8">
      <DropZone
        title={
          view.documents.length
            ? 'Добавьте ещё файлы клиента'
            : 'Отправьте файлы клиента в Anyko'
        }
        hint="Паспорт, СНИЛС, справки, выписки, договоры — PDF, DOCX или фото до 20 МБ, всего до 20 файлов. Новые файлы дополнят уже найденные сведения."
        inputLabel="Файлы клиента"
        accept={accept}
        busy={uploading}
        disabled={disabled.upload}
        onFiles={onUpload}
      />
      {uploads.length > 0 && (
        <ul className="grid gap-2" aria-label="Загрузка файлов">
          {uploads.map((item) => (
            <li
              key={item.id}
              className={`animate-rise flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${item.state === 'failed' ? 'border-red-400/25 bg-red-500/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'}`}
            >
              <span className="mt-0.5">
                {item.state === 'uploading' ? (
                  <Spinner className="size-4" />
                ) : item.state === 'done' ? (
                  <Check size={16} className="text-emerald-300" />
                ) : (
                  <X size={16} className="text-red-300" />
                )}
              </span>
              <span className="min-w-0 flex-1 wrap-anywhere">
                {item.state === 'failed'
                  ? item.reason
                  : `${item.name} — ${item.state === 'uploading' ? 'обрабатываем' : 'добавлен'}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!!view.checklist?.length && (
        <SourceChecklist view={view} onOpen={onOpen} />
      )}
      <section aria-labelledby="sources-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="sources-title"
            className="font-heading text-xl font-bold tracking-tight"
          >
            Файлы работы
            <span className="text-muted ml-2 text-base font-medium">
              {view.documents.length} из 20
            </span>
          </h2>
          <Button
            variant="secondary"
            disabled={disabled.attach}
            onClick={() => {
              setPicking(true);
            }}
          >
            <FolderOpen size={16} aria-hidden />
            Добавить из каталога
          </Button>
        </div>
        {!view.documents.length ? (
          <p className="glass text-muted rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center text-sm">
            Пока пусто. Загруженные файлы появятся здесь.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {view.documents.map((doc, index) => {
              const [label, tone] = labels[doc.status];
              const failure =
                doc.status === 'failed'
                  ? recognitionFailureText(doc.errorCode)
                  : undefined;
              const requiresRetry =
                doc.status === 'failed' &&
                doc.errorCode === recognitionRetryCode;
              return (
                <li
                  key={doc.id}
                  className={`animate-rise glass group/mist relative isolate flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.07] p-4 transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/30 hover:shadow-[0_16px_50px_-24px_#db143c88] ${stagger(index)}`}
                >
                  <HoverMist />
                  <FileIcon filename={doc.filename} />
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="text-sm font-medium wrap-anywhere">
                      {doc.filename}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill tone={tone}>{label}</StatusPill>
                      <span className="text-muted text-xs">
                        <RelativeTime value={doc.createdAt} />
                      </span>
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-1">
                    {doc.status === 'failed' && (
                      <DocumentRetryButton
                        loading={retryingId === doc.id}
                        disabled={retryDisabled}
                        onRetry={() => {
                          onRetry(doc.id);
                        }}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Просмотреть ${doc.filename}`}
                      title="Просмотреть"
                      disabled={doc.status !== 'succeeded' && !requiresRetry}
                      onClick={() => {
                        onOpen(doc);
                      }}
                    >
                      <Eye size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Убрать ${doc.filename} из работы`}
                      title="Убрать из работы"
                      disabled={disabled.remove}
                      onClick={() => {
                        setDeleting(doc);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  {failure && (
                    <p className="min-w-0 basis-full rounded-lg border border-red-400/15 bg-red-500/[0.06] px-3 py-2 text-xs leading-relaxed wrap-anywhere text-red-200">
                      {failure}
                    </p>
                  )}
                  {doc.status === 'succeeded' &&
                    doc.processingRevision != null && (
                      <OcrRevisionAction
                        workId={view.work.id}
                        documentId={doc.id}
                        filename={doc.filename}
                        current={doc.processingRevision}
                        latest={doc.readyRevision ?? doc.processingRevision}
                        disabled={disabled.updateRecognition}
                      />
                    )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {picking && (
        <DocumentPicker
          workspaceId={workspaceId}
          workId={view.work.id}
          attached={view.documents}
          onClose={() => {
            setPicking(false);
          }}
        />
      )}
      <Confirm
        open={!!deleting}
        title={`Убрать «${deleting?.filename ?? ''}» из работы?`}
        confirmLabel="Убрать из работы"
        pending={removing}
        onConfirm={() => {
          if (!deleting) return;
          void onDelete(deleting).finally(() => {
            setDeleting(undefined);
          });
        }}
        onCancel={() => {
          setDeleting(undefined);
        }}
      >
        Файл и распознавание сохранятся в каталоге и других работах. Если файл
        уже был прочитан или участвовал в извлечении, сведения и сформированные
        документы этой работы очистятся.
      </Confirm>
    </div>
  );
}
