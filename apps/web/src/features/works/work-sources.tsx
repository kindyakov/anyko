'use client';
import { Check, Eye, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { DropZone } from '@/components/ui/drop-zone';
import { FileIcon } from '@/components/ui/file-icon';
import { RelativeTime } from '@/components/ui/relative-time';
import { Spinner } from '@/components/ui/spinner';
import { stagger } from '@/components/ui/stagger';
import { StatusPill, type Tone } from '@/components/ui/status';
import type { WorkStage } from '@/features/works/journey';

type Document = WorkView['documents'][number];
export interface Upload {
  id: string;
  name: string;
  state: 'uploading' | 'done' | 'failed';
  reason?: string;
}

const accept = '.pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff';
const labels: Record<Document['status'], [string, Tone]> = {
  queued: ['Ожидает обработки', 'neutral'],
  running: ['Распознаётся', 'progress'],
  succeeded: ['Прочитан', 'success'],
  failed: ['Не удалось прочитать', 'danger'],
};

export function WorkSources({
  view,
  stage,
  locked,
  busy,
  uploads,
  onUpload,
  onDelete,
  onOpen,
  onAnalyze,
}: {
  view: WorkView;
  stage: WorkStage;
  /** Processing or cleanup is running: inputs must not change. */
  locked: boolean;
  busy: boolean;
  uploads: Upload[];
  onUpload: (files: File[]) => void;
  onDelete: (document: Document) => Promise<void>;
  onOpen: (document: Document) => void;
  onAnalyze: () => void;
}) {
  const [deleting, setDeleting] = useState<Document>();
  const [removing, setRemoving] = useState(false);
  const uploading = uploads.some((item) => item.state === 'uploading');
  const full = view.documents.length >= 20;
  return (
    <div className="grid grid-cols-1 gap-8">
      <DropZone
        title={
          view.documents.length
            ? 'Добавьте ещё файлы клиента'
            : 'Отправьте файлы клиента в Anyko'
        }
        hint={
          full
            ? 'В работе уже 20 файлов — это максимум. Удалите лишние, чтобы добавить новые.'
            : 'Паспорт, СНИЛС, справки, выписки, договоры — PDF, DOCX или фото до 20 МБ, всего до 20 файлов. Новые файлы дополнят уже найденные сведения.'
        }
        inputLabel="Файлы клиента"
        accept={accept}
        busy={uploading}
        disabled={locked || full || (busy && !uploading)}
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
                  : `${item.name} — ${item.state === 'uploading' ? 'передаём в Anyko' : 'загружен'}`}
              </span>
            </li>
          ))}
        </ul>
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
        </div>
        {!view.documents.length ? (
          <p className="text-muted rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center text-sm">
            Пока пусто. Загруженные файлы появятся здесь.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {view.documents.map((doc, index) => {
              const [label, tone] = labels[doc.status];
              return (
                <li
                  key={doc.id}
                  className={`animate-rise flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,#131317,#0d0d10)] p-4 transition-colors hover:border-white/15 ${stagger(index)}`}
                >
                  <FileIcon filename={doc.filename} />
                  <div className="min-w-0 flex-1">
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
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Просмотреть ${doc.filename}`}
                      title="Просмотреть"
                      disabled={doc.status !== 'succeeded'}
                      onClick={() => {
                        onOpen(doc);
                      }}
                    >
                      <Eye size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Удалить ${doc.filename}`}
                      title="Удалить"
                      disabled={busy || locked}
                      onClick={() => {
                        setDeleting(doc);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {view.documents.length > 0 && (
        <section className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-[radial-gradient(120%_160%_at_0%_0%,#2a0a1288,transparent_60%)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-lg font-bold">
              {stage.kind === 'ready'
                ? !stage.first
                  ? `Новых файлов: ${String(stage.pending)}. Обновите сведения`
                  : 'Файлы на месте. Можно извлекать сведения'
                : stage.kind === 'processing'
                  ? 'Anyko читает файлы'
                  : 'Сведения уже извлечены'}
            </p>
            <p className="text-muted mt-1.5 max-w-xl text-sm leading-6">
              Anyko распознает текст, изучит изображения и найдёт сведения для
              документов. Каждое значение будет со ссылкой на источник.
            </p>
          </div>
          <Button
            size="lg"
            variant={stage.kind === 'ready' ? 'primary' : 'secondary'}
            loading={busy && !uploading && !deleting}
            disabled={locked || uploading}
            onClick={onAnalyze}
          >
            <Sparkles size={18} />
            {view.runs.some((run) => run.kind === 'analysis')
              ? 'Извлечь заново'
              : 'Извлечь сведения'}
          </Button>
        </section>
      )}
      <Confirm
        open={!!deleting}
        title={`Удалить «${deleting?.filename ?? ''}»?`}
        confirmLabel="Удалить файл"
        pending={removing}
        onConfirm={() => {
          if (!deleting) return;
          setRemoving(true);
          void onDelete(deleting).finally(() => {
            setRemoving(false);
            setDeleting(undefined);
          });
        }}
        onCancel={() => {
          setDeleting(undefined);
        }}
      >
        Файл и всё, что из него извлечено, будут удалены. Сформированные
        документы этой работы тоже очистятся — их можно будет сформировать
        заново.
      </Confirm>
    </div>
  );
}
