'use client';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowLeft, RotateCw, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { type FieldKey, type FieldValue } from '@anyko/contracts/catalog';
import { type WorkView } from '@anyko/contracts/works';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice, StatusPill } from '@/components/ui/status';
import {
  DocumentViewer,
  type ViewedDocument,
} from '@/features/document-recognition';
import { WorkReview } from '@/features/fact-review';
import { useGenerateWork, WorkResults } from '@/features/work-generation';
import { WorkPipeline } from '@/features/work-processing';
import {
  type Upload,
  uploadWorkFiles,
  useDeleteWorkDocument,
  useUploadWorkDocument,
  WorkSources,
} from '@/features/work-sources';
import {
  describeWorkCommandError,
  type FactsDraft,
  type StepKey,
  stepOf,
  useAnalyzeWork,
  useConfirmWork,
  useSaveFacts,
  useWorkView,
  type WorkStage,
  workStage,
} from '@/features/works';
import { isUnauthorized } from '@/lib/api/errors';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

import { Hero } from './hero';
import { Stepper } from './stepper';

type Document = WorkView['documents'][number];

// Экран работы координирует шаги: выбирает открытый шаг, держит черновик сведений и
// просматриваемый документ. Вид работы — из кэша запросов, команды — в api/ features.
export function WorkScreen({ workId }: { workId: string }) {
  const workspaceId = useWorkspaceId();
  const [draft, setDraft] = useState<FactsDraft | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<StepKey>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<ViewedDocument>();
  const previousStage = useRef<WorkStage['kind']>(undefined);
  const { view, loadError, live, refetch } = useWorkView({
    workspaceId,
    workId,
  });
  const analysis = useAnalyzeWork(workspaceId, workId);
  const confirmation = useConfirmWork(workspaceId, workId);
  const factsSave = useSaveFacts(workspaceId, workId);
  const generation = useGenerateWork(workspaceId, workId);
  const uploadDocument = useUploadWorkDocument(workspaceId, workId);
  const deletion = useDeleteWorkDocument(workspaceId, workId);
  // Ключ каждой команды живёт на всё действие: повтор после неизвестного исхода передаёт тот же ключ.
  const analysisKey = useIdempotencyKey();
  const generationKey = useIdempotencyKey();
  const stage = view ? workStage(view) : undefined;
  // Open the step that matches the work's situation, and follow it when
  // background processing moves the work forward.
  useEffect(() => {
    if (!stage) return;
    const before = previousStage.current;
    previousStage.current = stage.kind;
    if (before === undefined) setStep(stepOf(stage));
    else if (before === 'processing' && stage.kind === 'review')
      setStep((current) => (current === 'extraction' ? 'review' : current));
  }, [stage]);
  // Работа, у которой удаляется исходник, не принимает правки: черновик сбрасывается, как только очистка
  // началась. Это корректировка состояния при рендере (документированный React-паттерн), не эффект.
  if (view?.cleanupPending && draft !== null) setDraft(null);
  const activeDraft = view?.cleanupPending ? null : draft;
  const uploading = uploads.some((item) => item.state === 'uploading');
  const commandPending =
    analysis.isPending ||
    confirmation.isPending ||
    factsSave.isPending ||
    generation.isPending ||
    deletion.isPending;
  // Сессия истекла: ошибка не показывается, оболочка перенаправит на вход.
  function fail(failure: unknown) {
    if (isUnauthorized(failure)) return;
    setError(describeWorkCommandError(failure));
  }
  async function upload(files: File[]) {
    setError('');
    await uploadWorkFiles(
      files,
      (file, idempotencyKey) =>
        uploadDocument.mutateAsync({ file, idempotencyKey }),
      setUploads,
    );
    setTimeout(() => {
      setUploads((items) => items.filter((item) => item.state !== 'done'));
    }, 2500);
  }
  async function deleteDocument(document: Document) {
    setDraft(null);
    setError('');
    try {
      await deletion.mutateAsync(document.id);
    } catch (failure) {
      fail(failure);
    }
  }
  if (!view || !stage)
    return loadError ? (
      <section className="animate-rise mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <EventHorizon state="calm" className="size-40" />
        <h1 className="font-heading mt-8 text-2xl font-bold">{loadError}</h1>
        <div className="mt-7 flex gap-3">
          <Link
            href={routes.works(workspaceId)}
            className="text-muted hover:text-ink self-center"
          >
            Все работы
          </Link>
          <Button
            onClick={() => {
              void refetch();
            }}
          >
            <RotateCw size={16} />
            Повторить
          </Button>
        </div>
      </section>
    ) : (
      <div aria-busy className="grid gap-6">
        <span role="status" className="sr-only">
          Открываем работу
        </span>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-2/3 max-w-xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  const locked =
    view.cleanupPending ||
    stage.kind === 'processing' ||
    stage.kind === 'generating';
  const busy = commandPending || uploading || view.cleanupPending;
  const values = activeDraft?.values ?? view.facts.values;
  const analyze = () => {
    setError('');
    analysis.mutate(
      { idempotencyKey: analysisKey.take() },
      {
        onSuccess: () => {
          analysisKey.settle();
          setStep('extraction');
        },
        onError: (failure) => {
          analysisKey.settle(failure);
          fail(failure);
        },
      },
    );
  };
  const generate = () => {
    setError('');
    generation.mutate(
      {
        revision: view.work.revision,
        idempotencyKey: generationKey.take(),
      },
      {
        onSuccess: () => {
          generationKey.settle();
          setStep('documents');
        },
        onError: (failure) => {
          generationKey.settle(failure);
          fail(failure);
        },
      },
    );
  };
  const confirm = () => {
    setError('');
    confirmation.mutate({ revision: view.work.revision }, { onError: fail });
  };
  const change = (changes: Partial<Record<FieldKey, FieldValue>>) => {
    setDraft({
      revision: activeDraft?.revision ?? view.work.revision,
      values: { ...values, ...changes },
    });
  };
  const openDocument = (document: Document) => {
    setViewing({
      id: document.id,
      filename: document.filename,
      owner: { kind: 'work', workId },
    });
  };
  const current = step ?? stepOf(stage);
  return (
    <>
      <div className="animate-rise">
        <Link
          href={routes.works(workspaceId)}
          className="text-muted hover:text-ink group inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft
            size={15}
            className="transition-transform group-hover:-translate-x-0.5"
          />
          Все работы
        </Link>
        <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight wrap-anywhere sm:text-3xl">
              {view.work.title}
            </h1>
            <p className="text-muted mt-2 text-sm">{view.package.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view.work.confirmedRevision === view.work.revision ? (
              <StatusPill tone="success">Подтверждена</StatusPill>
            ) : (
              <StatusPill tone="brand">В работе</StatusPill>
            )}
            <span
              role="status"
              className="text-muted flex items-center gap-2 rounded-full border border-white/[0.07] px-2.5 py-1 text-xs"
            >
              <span
                className={`size-1.5 rounded-full ${live === 'live' ? 'animate-blink bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`}
              />
              {live === 'live'
                ? 'Обновляется автоматически'
                : live === 'connecting'
                  ? 'Подключаемся'
                  : 'Переподключаемся — данные сохранены'}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {(error || loadError) && (
          <Notice tone="danger" role="alert">
            {error || loadError}
          </Notice>
        )}
        {view.cleanupPending && (
          <Notice tone="progress" role="status" title="Удаляем данные файла">
            Удаляем исходник и всё, что из него извлечено. Работа временно
            доступна только для просмотра.
          </Notice>
        )}
        <Hero
          stage={stage}
          step={current}
          busy={busy}
          locked={locked}
          onStep={setStep}
          onAnalyze={analyze}
          onGenerate={generate}
        />
      </div>
      <Tabs.Root
        value={current}
        onValueChange={(value: unknown) => {
          if (
            value === 'files' ||
            value === 'extraction' ||
            value === 'review' ||
            value === 'documents'
          )
            setStep(value);
        }}
        className="mt-6"
      >
        <Stepper current={stepOf(stage)} />
        <div className="mt-8">
          <Tabs.Panel value="files" className="animate-rise outline-none">
            <WorkSources
              view={view}
              stage={stage}
              locked={locked}
              busy={busy}
              uploads={uploads}
              onUpload={(files) => {
                void upload(files);
              }}
              onOpen={openDocument}
              onAnalyze={analyze}
              onDelete={deleteDocument}
            />
          </Tabs.Panel>
          <Tabs.Panel value="extraction" className="animate-rise outline-none">
            <WorkPipeline
              view={view}
              locked={locked}
              busy={busy}
              onOpen={openDocument}
              onAnalyze={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="review" className="animate-rise outline-none">
            <WorkReview
              view={view}
              values={values}
              busy={busy}
              onChange={change}
              onOpen={openDocument}
              onExtract={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="documents" className="animate-rise outline-none">
            <WorkResults
              view={view}
              locked={locked}
              busy={busy}
              hasDraft={!!activeDraft}
              onReview={() => {
                setStep('review');
              }}
              onConfirm={confirm}
              onGenerate={generate}
            />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
      {activeDraft && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:pl-[264px]">
          <div
            role="region"
            aria-label="Несохранённые правки"
            className="animate-rise pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-[#ff3b62]/30 bg-[#141418]/80 p-3 pl-5 shadow-[0_20px_60px_-10px_#000,0_0_40px_-16px_#db143c] backdrop-blur-xl"
          >
            <span className="bg-brand-hot animate-blink size-2 rounded-full shadow-[0_0_8px_#ff3b62]" />
            <p role="status" className="min-w-0 flex-1 text-sm">
              Есть несохранённые правки
              {activeDraft.revision !== view.work.revision && (
                <span className="block text-xs text-amber-200">
                  Работа изменилась после начала правок
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDraft(null);
              }}
            >
              <Undo2 size={15} />
              Отменить
            </Button>
            {activeDraft.revision !== view.work.revision && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft({
                    values: activeDraft.values,
                    revision: view.work.revision,
                  });
                }}
              >
                Перенести правки
              </Button>
            )}
            <Button
              size="sm"
              loading={factsSave.isPending}
              disabled={busy}
              onClick={() => {
                setError('');
                factsSave.mutate(activeDraft, {
                  onSuccess: () => {
                    setDraft(null);
                  },
                  onError: fail,
                });
              }}
            >
              <Save size={15} />
              Сохранить
            </Button>
          </div>
        </div>
      )}
      <DocumentViewer
        document={viewing}
        onClose={() => {
          setViewing(undefined);
        }}
      />
    </>
  );
}
