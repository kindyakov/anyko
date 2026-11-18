'use client';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowLeft, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { type WorkView } from '@anyko/contracts/works';
import { Button, Notice, Skeleton, StatusPill } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import {
  DocumentViewer,
  recognitionRetryCode,
  type ViewedDocument,
} from '@/features/document-recognition';
import {
  UnsavedFactsBar,
  useFactsForm,
  WorkReview,
} from '@/features/fact-review';
import { useGenerateWork, WorkResults } from '@/features/work-generation';
import { WorkPipeline } from '@/features/work-processing';
import {
  type Upload,
  uploadWorkFiles,
  useDeleteWorkDocument,
  useRetryWorkDocument,
  useUploadWorkDocument,
  WorkSources,
} from '@/features/work-sources';
import {
  describeWorkCommandError,
  errorText,
  type StepKey,
  stepOf,
  useAnalyzeWork,
  useConfirmWork,
  useWorkView,
  type WorkStage,
  workStage,
} from '@/features/works';
import { isUnauthorized } from '@/lib/api/errors';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';
import { UnsavedNavigation } from '@/lib/unsaved-navigation';

import { Hero } from './hero';
import { Stepper } from './stepper';

type Document = WorkView['documents'][number];

type LiveState = ReturnType<typeof useWorkView>['live'];

// Экран работы координирует шаги: выбирает открытый шаг и просматриваемый документ. Вид работы — из кэша
// запросов, команды — в api/ features, правки сведений — в форме fact-review. Пока вид не загружен,
// экран показывает загрузку или ошибку.
export function WorkScreen({ workId }: { workId: string }) {
  const workspaceId = useWorkspaceId();
  const { view, loadError, live, refetch, canRetry } = useWorkView({
    workspaceId,
    workId,
  });
  if (!view)
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
          {canRetry && (
            <Button
              onClick={() => {
                void refetch();
              }}
            >
              <RotateCw size={16} />
              Повторить
            </Button>
          )}
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
  return (
    <WorkBody workId={workId} view={view} live={live} loadError={loadError} />
  );
}

function WorkBody({
  workId,
  view,
  live,
  loadError,
}: {
  workId: string;
  view: WorkView;
  live: LiveState;
  loadError: string;
}) {
  const workspaceId = useWorkspaceId();
  const [error, setError] = useState('');
  const [step, setStep] = useState<StepKey>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<ViewedDocument>();
  const previousStage = useRef<WorkStage['kind']>(undefined);
  const analysis = useAnalyzeWork(workspaceId, workId);
  const confirmation = useConfirmWork(workspaceId, workId);
  const facts = useFactsForm(view);
  const generation = useGenerateWork(workspaceId, workId);
  const uploadDocument = useUploadWorkDocument(workspaceId, workId);
  const deletion = useDeleteWorkDocument(workspaceId, workId);
  const retry = useRetryWorkDocument(workspaceId, workId);
  // Ключ каждой команды живёт на всё действие: повтор после неизвестного исхода передаёт тот же ключ.
  const analysisKey = useIdempotencyKey();
  const generationKey = useIdempotencyKey();
  const stage = workStage(view);
  // Open the step that matches the work's situation, and follow it when
  // background processing moves the work forward.
  useEffect(() => {
    const before = previousStage.current;
    previousStage.current = stage.kind;
    if (before === undefined) setStep(stepOf(stage));
    else if (before === 'processing' && stage.kind === 'review')
      setStep((current) => (current === 'extraction' ? 'review' : current));
  }, [stage]);
  const uploading = uploads.some((item) => item.state === 'uploading');
  const commandPending =
    analysis.isPending ||
    confirmation.isPending ||
    facts.saving ||
    generation.isPending ||
    retry.isPending ||
    deletion.isPending;
  // Сессия истекла: ошибка не показывается, оболочка перенаправит на вход.
  function fail(failure: unknown) {
    if (isUnauthorized(failure)) return;
    setError(describeWorkCommandError(failure));
  }
  async function upload(files: File[]) {
    setError('');
    const accepted = await uploadWorkFiles(
      files,
      (file, idempotencyKey) =>
        uploadDocument.mutateAsync({ file, idempotencyKey }),
      setUploads,
    );
    setTimeout(() => {
      setUploads((items) => items.filter((item) => item.state !== 'done'));
    }, 2500);
    return accepted;
  }
  async function deleteDocument(document: Document) {
    // Удаление исходника сбрасывает несохранённые правки, как и раньше.
    facts.discard();
    setError('');
    try {
      await deletion.mutateAsync(document.id);
    } catch (failure) {
      fail(failure);
    }
  }
  function retryDocument(documentId: string) {
    setError('');
    retry.mutate(documentId, { onError: fail });
  }
  const locked =
    view.cleanupPending ||
    stage.kind === 'processing' ||
    stage.kind === 'generating';
  const busy = commandPending || uploading || view.cleanupPending;
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
  const openDocument = (document: Document, page?: number) => {
    setViewing({
      id: document.id,
      filename: document.filename,
      owner: { kind: 'work', workId },
      ...(page && { page }),
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
        {stage.kind === 'review' &&
          current !== 'extraction' &&
          (stage.run.errorCode === 'CONNECTION_REVOKED' ||
            stage.run.steps.some(
              (item) => item.errorCode === 'CONNECTION_REVOKED',
            )) && (
            <Notice tone="warning" role="status">
              {errorText('CONNECTION_REVOKED')}
            </Notice>
          )}
        {view.cleanupPending && (
          <Notice
            tone="progress"
            role="status"
            title="Обновляем источники работы"
          >
            Очищаем сведения и готовые документы этой работы. Исходный файл
            сохраняется в каталоге.
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
          <Tabs.Panel
            value="files"
            keepMounted
            className="animate-rise outline-none"
          >
            <WorkSources
              view={view}
              stage={stage}
              locked={locked}
              busy={busy}
              uploads={uploads}
              onUpload={upload}
              onOpen={openDocument}
              onAnalyze={analyze}
              onDelete={deleteDocument}
              onRetry={retryDocument}
              retryingId={retry.isPending ? retry.variables : undefined}
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
              facts={facts}
              busy={busy}
              onOpen={openDocument}
              onExtract={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="documents" className="animate-rise outline-none">
            <WorkResults
              view={view}
              locked={locked}
              busy={busy}
              hasDraft={facts.hasEdits}
              onReview={() => {
                setStep('review');
              }}
              onConfirm={confirm}
              onGenerate={generate}
            />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
      <UnsavedNavigation dirty={facts.hasEdits} />
      <UnsavedFactsBar facts={facts} busy={busy} />
      <DocumentViewer
        document={viewing}
        requiresRetry={
          viewing !== undefined &&
          view.documents.find((item) => item.id === viewing.id)?.errorCode ===
            recognitionRetryCode
        }
        retryDisabled={busy || locked}
        onRetry={retryDocument}
        onClose={() => {
          setViewing(undefined);
        }}
      />
    </>
  );
}
