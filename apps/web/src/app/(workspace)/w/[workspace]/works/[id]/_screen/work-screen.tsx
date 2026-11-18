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
import { WorkResults } from '@/features/work-generation';
import { WorkPipeline } from '@/features/work-processing';
import { WorkSources } from '@/features/work-sources';
import {
  type StepKey,
  stepOf,
  useWorkCommands,
  useWorkView,
  type WorkStage,
  workStage,
} from '@/features/works';
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
    <WorkBody
      key={workId}
      workId={workId}
      view={view}
      live={live}
      loadError={loadError}
    />
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
  const [step, setStep] = useState<StepKey>();
  const [viewing, setViewing] = useState<ViewedDocument>();
  const previousStage = useRef<WorkStage['kind']>(undefined);
  const facts = useFactsForm(view);
  const commands = useWorkCommands(workspaceId, view, facts.saving);
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
  const analyze = () => {
    commands.analyze(() => {
      setStep('extraction');
    });
  };
  const generate = () => {
    commands.generate(() => {
      setStep('documents');
    });
  };
  async function deleteDocument(document: Document) {
    facts.discard();
    await commands.remove(document.id);
  }
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
        {(commands.error || loadError) && (
          <Notice tone="danger" role="alert">
            {commands.error || loadError}
          </Notice>
        )}
        {commands.reasons.length > 0 && (
          <Notice tone="warning" role="status">
            <ul>
              {commands.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Notice>
        )}
        {view.cleanupPending && (
          <Notice tone="progress" role="status" title="Удаляем данные файла">
            Удаляем исходник и всё, что из него извлечено.
          </Notice>
        )}
        <Hero
          stage={stage}
          step={current}
          busy={commands.pending}
          analyzeDisabled={commands.disabled.analyze}
          generateDisabled={commands.disabled.generate}
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
              disabled={commands.disabled}
              busy={commands.pending}
              uploads={commands.uploads}
              onUpload={commands.upload}
              onOpen={openDocument}
              onAnalyze={analyze}
              onDelete={deleteDocument}
              onRetry={commands.retry}
              removing={commands.removing}
              retryDisabled={commands.editingBlocked}
              retryingId={commands.retryingId}
            />
          </Tabs.Panel>
          <Tabs.Panel value="extraction" className="animate-rise outline-none">
            <WorkPipeline
              view={view}
              analyzeDisabled={commands.disabled.analyze}
              busy={commands.pending}
              onOpen={openDocument}
              onAnalyze={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="review" className="animate-rise outline-none">
            <WorkReview
              view={view}
              facts={facts}
              busy={commands.editingBlocked}
              analyzeDisabled={commands.disabled.analyze}
              onOpen={openDocument}
              onExtract={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="documents" className="animate-rise outline-none">
            <WorkResults
              view={view}
              confirmDisabled={commands.disabled.confirm}
              generateDisabled={commands.disabled.generate}
              busy={commands.pending}
              hasDraft={facts.hasEdits}
              onReview={() => {
                setStep('review');
              }}
              onConfirm={commands.confirm}
              onGenerate={generate}
            />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
      <UnsavedNavigation dirty={facts.hasEdits} />
      <UnsavedFactsBar facts={facts} busy={commands.editingBlocked} />
      <DocumentViewer
        document={viewing}
        requiresRetry={
          viewing !== undefined &&
          view.documents.find((item) => item.id === viewing.id)?.errorCode ===
            recognitionRetryCode
        }
        retryDisabled={commands.editingBlocked}
        onRetry={commands.retry}
        onClose={() => {
          setViewing(undefined);
        }}
      />
    </>
  );
}
