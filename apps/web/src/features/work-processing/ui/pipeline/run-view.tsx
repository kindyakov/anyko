'use client';
import { Eye, GitMerge, Minus, Plus, RotateCw } from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import {
  Button,
  Disclosure,
  FileIcon,
  Modal,
  Notice,
  stagger,
} from '@anyko/ui';

import {
  groupSteps,
  visionVisuals,
} from '@/features/work-processing/model/pipeline';
import { errorText, stageLabels, stepStatusLabels } from '@/features/works';

import { Connector, StepNode } from './step-node';

type Run = WorkView['runs'][number];
type Document = WorkView['documents'][number];
type ImageUrl = (documentId: string, index: number) => string;

export function RunView({
  run,
  documents,
  onOpen,
  imageUrl,
}: {
  run: Run;
  documents: Document[];
  onOpen: (document: Document) => void;
  imageUrl: ImageUrl;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const groups = groupSteps(run.steps);
  const failures = run.steps.filter((step) => step.errorCode);
  return (
    <div className="grid gap-3">
      {[...groups].map(([documentId, steps], index) => {
        const doc = documents.find((item) => item.id === documentId);
        const visuals = visionVisuals(steps, documentId);
        return (
          <div
            key={documentId ?? 'work'}
            className={`animate-rise glass rounded-2xl border border-white/[0.07] p-4 ${stagger(index)}`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-3 lg:w-72">
                {documentId ? (
                  <FileIcon
                    filename={doc?.filename ?? ''}
                    className="size-10"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                    <GitMerge size={18} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {documentId
                      ? (doc?.filename ?? 'Удалённый файл')
                      : 'Все файлы вместе'}
                  </p>
                  {doc?.status === 'succeeded' && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="mt-1"
                      onClick={() => {
                        onOpen(doc);
                      }}
                    >
                      <Eye size={13} /> Распознанный текст
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-nowrap">
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    className="flex min-w-0 flex-1 basis-40 items-center gap-3"
                  >
                    {i > 0 && (
                      <Connector lit={steps[i - 1]?.status === 'succeeded'} />
                    )}
                    <StepNode step={step} />
                  </div>
                ))}
              </div>
            </div>
            {visuals.length > 0 && (
              <Disclosure
                className="mt-3 border-t border-white/[0.06] pt-1"
                title={
                  <span className="text-muted text-xs">
                    Что Anyko увидел на изображениях · {visuals.length}
                  </span>
                }
              >
                <ul className="grid gap-3 md:grid-cols-2">
                  {visuals.map((visual) => {
                    const source =
                      visual.documentId && visual.imageIndex !== undefined
                        ? imageUrl(visual.documentId, visual.imageIndex)
                        : undefined;
                    return (
                      <li
                        key={visual.key}
                        className="flow-root rounded-xl border border-white/[0.06] bg-black/30 p-3"
                      >
                        {source && (
                          <button
                            type="button"
                            aria-label="Открыть изображение из файла"
                            className="float-left mr-3 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                            onClick={() => {
                              setZoom(1);
                              setRotation(0);
                              setPreview(source);
                            }}
                          >
                            <img
                              src={source}
                              alt=""
                              loading="lazy"
                              className="size-20 rounded-lg bg-white object-contain"
                            />
                          </button>
                        )}
                        <p className="text-muted text-xs leading-5">
                          {visual.description}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Disclosure>
            )}
          </div>
        );
      })}
      {run.errorCode === 'CONNECTION_REVOKED' &&
        !failures.some((step) => step.errorCode === run.errorCode) && (
          <Notice tone="warning" role="status">
            {errorText(run.errorCode)}
          </Notice>
        )}
      {failures.map((step) => (
        <Notice
          key={step.id}
          tone="warning"
          title={`${stageLabels[step.stage]}: ${stepStatusLabels[step.status].toLowerCase()}`}
        >
          {errorText(step.errorCode ?? '')}
        </Notice>
      ))}
      <Modal
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="Изображение из файла"
        size="wide"
        headerExtra={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Уменьшить"
              disabled={zoom <= 1}
              onClick={() => {
                setZoom((value) => Math.max(1, value - 0.25));
              }}
            >
              <Minus size={18} />
            </Button>
            <span
              className="text-muted w-12 text-center text-xs"
              aria-live="polite"
            >
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Увеличить"
              disabled={zoom >= 4}
              onClick={() => {
                setZoom((value) => Math.min(4, value + 0.25));
              }}
            >
              <Plus size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Повернуть по часовой стрелке"
              onClick={() => {
                setRotation((value) => value + 90);
              }}
            >
              <RotateCw size={18} />
            </Button>
          </div>
        }
      >
        {preview && (
          <div className="grid min-h-0 flex-1 overflow-auto rounded-xl bg-black/40 p-3">
            <div
              className="relative m-auto shrink-0"
              style={{
                width:
                  (rotation % 180 ? imageSize.height : imageSize.width) * zoom,
                height:
                  (rotation % 180 ? imageSize.width : imageSize.height) * zoom,
              }}
            >
              <img
                src={preview}
                alt="Изображение из файла в увеличенном размере"
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  const fit = Math.min(
                    1,
                    (window.innerWidth * 0.7) / naturalWidth,
                    (window.innerHeight * 0.65) / naturalHeight,
                  );
                  setImageSize({
                    width: naturalWidth * fit,
                    height: naturalHeight * fit,
                  });
                }}
                className="absolute top-1/2 left-1/2 max-w-none rounded bg-white"
                style={{
                  width: imageSize.width * zoom,
                  height: imageSize.height * zoom,
                  transform: `translate(-50%, -50%) rotate(${String(rotation)}deg)`,
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
