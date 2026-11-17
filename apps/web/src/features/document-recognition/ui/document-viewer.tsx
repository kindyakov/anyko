'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, FileWarning, RotateCw } from 'lucide-react';
import { useState } from 'react';

import {
  getDocumentImage,
  getDocumentSource,
} from '@anyko/contracts/documents';
import {
  getWorkDocumentImage,
  getWorkDocumentSource,
} from '@anyko/contracts/works';
import {
  Button,
  buttonStyles,
  Modal,
  Notice,
  SegmentedControl,
  Skeleton,
} from '@anyko/ui';

import {
  type DocumentOwner,
  documentResultQueryOptions,
} from '@/features/document-recognition/api/queries';
import { ResultPreview } from '@/features/document-recognition/ui/result-preview';
import { endpointUrl } from '@/lib/api/call';
import { ApiError } from '@/lib/api/errors';
import { useWorkspaceId } from '@/lib/api/workspace';

import { recognitionRetryText } from '../model/error-texts';

import { DocumentRetryButton } from './retry-button';

type Mode = 'split' | 'text' | 'source' | 'markdown';

// Документ работы открывается через её адрес; документ распознавания — собственными endpoint.
export type ViewedDocument = {
  id: string;
  filename: string;
  owner: DocumentOwner;
};

function documentKind(filename: string) {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'tif' || extension === 'tiff') return 'tiff';
  if (extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension))
    return 'image';
  return 'other';
}

// Адреса исходника и изображений зависят от владельца документа, как и адрес результата.
function documentLinks(workspaceId: string, document: ViewedDocument) {
  const documentId = document.id;
  if (document.owner.kind === 'work') {
    const workId = document.owner.workId;
    return {
      source: endpointUrl(getWorkDocumentSource, {
        params: { workspaceId, workId, documentId },
      }),
      image: (index: number) =>
        endpointUrl(getWorkDocumentImage, {
          params: { workspaceId, workId, documentId, index: String(index) },
        }),
    };
  }
  return {
    source: endpointUrl(getDocumentSource, {
      params: { workspaceId, documentId },
    }),
    image: (index: number) =>
      endpointUrl(getDocumentImage, {
        params: { workspaceId, documentId, index: String(index) },
      }),
  };
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

function Original({ filename, source }: { filename: string; source: string }) {
  const kind = documentKind(filename);
  if (kind === 'image')
    return (
      <div className="grid min-h-full place-items-center p-4">
        <img
          src={source}
          alt={`Оригинал: ${filename}`}
          className="animate-fade max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_60px_-20px_#000]"
        />
      </div>
    );
  if (kind === 'pdf')
    return (
      <iframe
        src={source}
        title={`Оригинал: ${filename}`}
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
  requiresRetry,
  retryDisabled,
  onRetry,
  onClose,
}: {
  document: ViewedDocument | undefined;
  requiresRetry: boolean;
  retryDisabled: boolean;
  onRetry: (documentId: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('split');
  const [copied, setCopied] = useState(false);
  const workspaceId = useWorkspaceId();
  const result = useQuery({
    ...documentResultQueryOptions(
      workspaceId,
      document?.id ?? '',
      document?.owner ?? { kind: 'recognition' },
    ),
    enabled: !!document,
    staleTime: 5 * 60_000,
  });
  // Текст строится для того документа, который открыт; без документа запрос не выполняется.
  const text = (viewed: ViewedDocument) =>
    result.isPending ? (
      <PaperSkeleton />
    ) : requiresRetry &&
      result.error instanceof ApiError &&
      result.error.status === 409 &&
      result.error.code === 'NOT_READY' ? (
      <Notice
        tone="warning"
        role="status"
        title={recognitionRetryText}
        action={
          <DocumentRetryButton
            disabled={retryDisabled}
            onRetry={() => {
              onClose();
              onRetry(viewed.id);
            }}
          />
        }
      />
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
        imageUrl={documentLinks(workspaceId, viewed).image}
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
                href={documentLinks(workspaceId, document).source}
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
                <Original
                  filename={document.filename}
                  source={documentLinks(workspaceId, document).source}
                />
              </section>
            )}
            {mode !== 'source' && (
              <section
                aria-label="Распознанный текст"
                className="min-h-0 overflow-auto rounded-2xl bg-[#1b1b20] p-3 sm:p-6"
              >
                {text(document)}
              </section>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
