'use client';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowLeft, RotateCw, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { FieldKey, FieldValue } from '@anyko/contracts';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice, StatusPill } from '@/components/ui/status';
import {
  DocumentViewer,
  type ViewedDocument,
} from '@/features/document-recognition';
import { WorkReview } from '@/features/fact-review';
import { generateWork, WorkResults } from '@/features/work-generation';
import { WorkPipeline } from '@/features/work-processing';
import {
  deleteWorkDocument,
  type Upload,
  uploadWorkFiles,
  WorkSources,
} from '@/features/work-sources';
import {
  analyzeWork,
  confirmWork,
  type FactsDraft,
  saveFacts,
  type StepKey,
  stepOf,
  useWorkView,
  type WorkStage,
  workStage,
} from '@/features/works';
import { ApiError } from '@/lib/api/errors';
import { useExpireSession } from '@/lib/api/query-client';
import { useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

import { Hero } from './hero';
import { Stepper } from './stepper';

// Экран работы координирует шаги: выбирает открытый шаг, держит черновик сведений и
// просматриваемый документ. Данные и подписка на события — в features/works, команды — в api/ шагов.
export function WorkScreen({ workId }: { workId: string }) {
  const workspaceId = useWorkspaceId();
  const expireSession = useExpireSession();
  const [draft, setDraft] = useState<FactsDraft | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<StepKey>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<ViewedDocument>();
  const previousStage = useRef<WorkStage['kind']>(undefined);
  const { view, loadError, live, load } = useWorkView({
    workId,
    // Работа, у которой удаляется исходник, не принимает правки: черновик сбрасывается.
    onLoaded: (loaded) => {
      if (loaded.cleanupPending) setDraft(null);
    },
  });
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
  async function command(operation: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await operation();
      await load();
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        expireSession();
      else
        setError(
          failure instanceof ApiError && failure.code === 'REVISION_CONFLICT'
            ? 'Работа изменилась, пока вы редактировали. Ваши правки сохранены в полях — нажмите «Перенести правки», затем сохраните.'
            : failure instanceof ApiError
              ? `Операция не выполнена: ${failure.code}`
              : 'Операция не выполнена. Повторите попытку.',
        );
      return false;
    } finally {
      setPending(false);
    }
  }
  async function upload(files: File[]) {
    setPending(true);
    setError('');
    try {
      const result = await uploadWorkFiles(workId, files, setUploads);
      if (result === 'unauthorized') {
        expireSession();
        return;
      }
      await load();
    } finally {
      setPending(false);
      setTimeout(() => {
        setUploads((items) => items.filter((item) => item.state !== 'done'));
      }, 2500);
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
              void load();
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
  const busy = pending || view.cleanupPending;
  const values = draft?.values ?? view.facts.values;
  const analyze = () => {
    void command(() => analyzeWork(workId)).then((ok) => {
      if (ok) setStep('extraction');
    });
  };
  const generate = () => {
    void command(() => generateWork(workId, view.work.revision)).then((ok) => {
      if (ok) setStep('documents');
    });
  };
  const change = (changes: Partial<Record<FieldKey, FieldValue>>) => {
    setDraft({
      revision: draft?.revision ?? view.work.revision,
      values: { ...values, ...changes },
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
              onOpen={setViewing}
              onAnalyze={analyze}
              onDelete={async (doc) => {
                setDraft(null);
                await command(() => deleteWorkDocument(workId, doc.id));
              }}
            />
          </Tabs.Panel>
          <Tabs.Panel value="extraction" className="animate-rise outline-none">
            <WorkPipeline
              view={view}
              locked={locked}
              busy={busy}
              onOpen={setViewing}
              onAnalyze={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="review" className="animate-rise outline-none">
            <WorkReview
              view={view}
              values={values}
              busy={busy}
              onChange={change}
              onOpen={setViewing}
              onExtract={analyze}
            />
          </Tabs.Panel>
          <Tabs.Panel value="documents" className="animate-rise outline-none">
            <WorkResults
              view={view}
              locked={locked}
              busy={busy}
              hasDraft={!!draft}
              onReview={() => {
                setStep('review');
              }}
              onConfirm={() => {
                void command(() => confirmWork(workId, view.work.revision));
              }}
              onGenerate={generate}
            />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
      {draft && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:pl-[264px]">
          <div
            role="region"
            aria-label="Несохранённые правки"
            className="animate-rise pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-[#ff3b62]/30 bg-[#141418]/80 p-3 pl-5 shadow-[0_20px_60px_-10px_#000,0_0_40px_-16px_#db143c] backdrop-blur-xl"
          >
            <span className="bg-brand-hot animate-blink size-2 rounded-full shadow-[0_0_8px_#ff3b62]" />
            <p role="status" className="min-w-0 flex-1 text-sm">
              Есть несохранённые правки
              {draft.revision !== view.work.revision && (
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
            {draft.revision !== view.work.revision && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft({
                    values: draft.values,
                    revision: view.work.revision,
                  });
                }}
              >
                Перенести правки
              </Button>
            )}
            <Button
              size="sm"
              loading={pending}
              disabled={busy}
              onClick={() => {
                void command(async () => {
                  await saveFacts(workId, draft);
                  setDraft(null);
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
