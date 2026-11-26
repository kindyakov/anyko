'use client';
import { Tabs } from '@base-ui/react/tabs';
import { RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { type WorkView } from '@anyko/contracts/works';
import { Button, Notice, Skeleton, useWideLayout } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import {
  DocumentViewer,
  recognitionRetryCode,
  type ViewedDocument,
} from '@/features/document-recognition';
import {
  reviewSummary,
  UnsavedFactsBar,
  useFactsForm,
  WorkReview,
} from '@/features/fact-review';
import { type AgentTab, WorkAgentPanel } from '@/features/work-chat';
import { WorkResults } from '@/features/work-generation';
import { WorkPipeline } from '@/features/work-processing';
import { WorkChecklist, WorkSources } from '@/features/work-sources';
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

import { NextStep } from './next-step';
import { Stepper } from './stepper';
import { WorkHeader } from './work-header';

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
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentTab, setAgentTab] = useState<AgentTab>('chat');
  const [checklistOpen, setChecklistOpen] = useState(false);
  const wide = useWideLayout();
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
      owner: { kind: 'work', workId, revision: document.processingRevision },
      ...(page && { page }),
    });
  };
  const current = step ?? stepOf(stage);
  const openedSource = view.documents.find(({ id }) => id === viewing?.id);
  const openedRevision = openedSource?.processingRevision;
  const docked = wide && agentOpen;
  return (
    <>
      <div
        className={
          docked
            ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]'
            : view.checklist?.length
              ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_16.5rem] 2xl:grid-cols-[minmax(0,1fr)_18rem]'
              : undefined
        }
      >
        <div className="min-w-0">
          <WorkHeader
            workspaceId={workspaceId}
            view={view}
            live={live}
            agentOpen={agentOpen}
            agentBusy={stage.kind === 'processing'}
            onAgent={() => {
              setAgentOpen((open) => !open);
            }}
            onChecklist={
              view.checklist?.length && (!wide || docked)
                ? () => {
                    setChecklistOpen(true);
                  }
                : undefined
            }
          />
          <div className="mb-4 grid grid-cols-1 gap-3 empty:hidden">
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
              <Notice
                tone="progress"
                role="status"
                title="Обновляем источники работы"
              >
                Очищаем сведения и готовые документы этой работы. Исходный файл
                сохраняется в каталоге.
              </Notice>
            )}
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
          >
            <Stepper
              current={stepOf(stage)}
              view={view}
              stage={stage}
              review={reviewSummary(view, facts.values)}
            />
            <div className="mt-3 empty:hidden">
              <NextStep
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
            <div className="mt-6">
              <Tabs.Panel
                value="files"
                keepMounted
                className="animate-rise outline-none"
              >
                <WorkSources
                  view={view}
                  disabled={commands.disabled}
                  uploads={commands.uploads}
                  onUpload={commands.upload}
                  onOpen={openDocument}
                  onDelete={deleteDocument}
                  onRetry={commands.retry}
                  removing={commands.removing}
                  retryDisabled={commands.editingBlocked}
                  retryingId={commands.retryingId}
                />
              </Tabs.Panel>
              <Tabs.Panel
                value="extraction"
                className="animate-rise outline-none"
              >
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
                  onOpen={openDocument}
                />
              </Tabs.Panel>
              <Tabs.Panel
                value="documents"
                className="animate-rise outline-none"
              >
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
        </div>
        <WorkAgentPanel
          workspaceId={workspaceId}
          view={view}
          open={agentOpen && !view.cleanupPending}
          tab={agentTab}
          onOpenChange={setAgentOpen}
          onTab={setAgentTab}
        />
        <WorkChecklist
          view={view}
          docked={wide && !docked}
          open={checklistOpen}
          onOpenChange={setChecklistOpen}
          onOpen={openDocument}
        />
      </div>
      <UnsavedNavigation dirty={facts.hasEdits} />
      {commands.uploadMatchDialog}
      <UnsavedFactsBar facts={facts} busy={commands.editingBlocked} />
      <DocumentViewer
        document={
          viewing && openedSource
            ? {
                id: viewing.id,
                filename: viewing.filename,
                owner: { kind: 'work', workId, revision: openedRevision },
                ...(viewing.page &&
                  viewing.owner.revision === openedRevision && {
                    page: viewing.page,
                  }),
              }
            : undefined
        }
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
