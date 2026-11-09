'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, FileWarning, RotateCw } from 'lucide-react';
import { useState } from 'react';

import { documentResultSchema } from '@anyko/contracts';

import { Button, buttonStyles } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice } from '@/components/ui/status';
import { ResultPreview } from '@/features/documents/result-preview';
import { requestApi } from '@/lib/api/client';

type Mode = 'split' | 'text' | 'source' | 'markdown';
export type ViewedDocument = { id: string; filename: string };

function documentKind(filename: string) {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'tif' || extension === 'tiff') return 'tiff';
  if (extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension))
    return 'image';
  return 'other';
}

function PaperSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[860px] rounded-sm bg-white/[0.04] p-10"
      aria-hidden
    >
      <Skeleton className="h-7 w-2/3" />
      {[90, 100, 84, 96, 70, 100, 88, 60].map((width, index) => (
        <Skeleton
          key={index}
          className={`mt-4 h-3.5 ${width === 100 ? 'w-full' : width > 85 ? 'w-11/12' : width > 65 ? 'w-3/4' : 'w-1/2'}`}
        />
      ))}
    </div>
  );
}

function Original({ document }: { document: ViewedDocument }) {
  const url = `/api/documents/${encodeURIComponent(document.id)}/source`;
  const kind = documentKind(document.filename);
  if (kind === 'image')
    return (
      <div className="grid min-h-full place-items-center p-4">
        <img
          src={url}
          alt={`Оригинал: ${document.filename}`}
          className="animate-fade max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_60px_-20px_#000]"
        />
      </div>
    );
  if (kind === 'pdf')
    return (
      <iframe
        src={url}
        title={`Оригинал: ${document.filename}`}
        className="animate-fade size-full min-h-[60dvh] rounded-xl bg-white"
      />
    );
  return (
    <div className="grid min-h-full place-items-center p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
          <FileWarning size={24} />
        </span>
        <p className="mt-4 font-medium">
          {kind === 'docx'
            ? 'Браузер не показывает DOCX'
            : 'Браузер не показывает этот формат'}
        </p>
        <p className="text-muted mt-2 text-sm leading-6">
          Откройте оригинал в отдельной вкладке или сверяйтесь с распознанным
          текстом.
        </p>
      </div>
    </div>
  );
}

export function DocumentViewer({
  document,
  onClose,
}: {
  document: ViewedDocument | undefined;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('split');
  const [copied, setCopied] = useState(false);
  const result = useQuery({
    queryKey: ['document-result', document?.id],
    enabled: !!document,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      requestApi(
        `/documents/${encodeURIComponent(document?.id ?? '')}/result`,
        documentResultSchema,
        { signal },
      ),
  });
  const text = result.isPending ? (
    <PaperSkeleton />
  ) : result.isError ? (
    <Notice
      tone="warning"
      role="status"
      title="Распознанный текст пока недоступен"
      action={
        <Button
          variant="secondary"
          size="sm"
          loading={result.isFetching}
          onClick={() => {
            void result.refetch();
          }}
        >
          <RotateCw size={15} />
          Повторить
        </Button>
      }
    >
      Если файл ещё обрабатывается, подождите завершения распознавания.
    </Notice>
  ) : mode === 'markdown' ? (
    <pre className="mx-auto w-full max-w-[860px] overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/50 p-6 font-mono text-[13px] leading-6 whitespace-pre-wrap text-zinc-300">
      {result.data.markdown || 'В документе не найден текст.'}
    </pre>
  ) : (
    <ResultPreview
      markdown={result.data.markdown}
      images={result.data.images}
    />
  );
  return (
    <Modal
      open={!!document}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="wide"
      title={document?.filename ?? ''}
      description="Автоматически распознанный текст. Сверяйте важные сведения с оригиналом."
      closeLabel="Закрыть просмотр"
    >
      {document && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Режим просмотра"
              size="sm"
              value={mode}
              onValueChange={setMode}
              items={[
                { value: 'split', label: 'Рядом с оригиналом' },
                { value: 'text', label: 'Текст' },
                { value: 'source', label: 'Оригинал' },
                { value: 'markdown', label: 'Markdown' },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {mode === 'markdown' && result.data && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(result.data.markdown)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => {
                          setCopied(false);
                        }, 1500);
                      });
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
              )}
              <a
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                href={`/api/documents/${encodeURIComponent(document.id)}/source`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Оригинал в новой вкладке
              </a>
            </div>
          </div>
          <div
            className={`grid min-h-0 flex-1 gap-4 ${mode === 'split' ? 'lg:grid-cols-2' : ''}`}
          >
            {(mode === 'split' || mode === 'source') && (
              <section
                aria-label="Оригинал"
                className="min-h-[50dvh] overflow-auto rounded-2xl border border-white/[0.07] bg-[#050507] lg:min-h-0"
              >
                <Original document={document} />
              </section>
            )}
            {mode !== 'source' && (
              <section
                aria-label="Распознанный текст"
                className="min-h-0 overflow-auto rounded-2xl bg-[#1b1b20] p-3 sm:p-6"
              >
                {text}
              </section>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
