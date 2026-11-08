'use client';
import { Tabs } from '@base-ui/react/tabs';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSearch,
  PackageCheck,
  RotateCw,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import {
  documentResponseSchema,
  type FieldKey,
  type FieldValue,
  type FieldValues,
  workResponseSchema,
  type WorkView,
} from '@anyko/contracts';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice, StatusPill } from '@/components/ui/status';
import { DocumentViewer, type ViewedDocument } from '@/features/documents';
import {
  journeySteps,
  type StepKey,
  stepOf,
  type WorkStage,
  workStage,
} from '@/features/works/journey';
import { uploadFailureMessage } from '@/features/works/upload-errors';
import { WorkPipeline } from '@/features/works/work-pipeline';
import { WorkResults } from '@/features/works/work-results';
import { WorkReview } from '@/features/works/work-review';
import { type Upload, WorkSources } from '@/features/works/work-sources';
import { ApiError, requestApi } from '@/lib/api/client';

const accepted = z.object({ status: z.string() });
type Live = 'connecting' | 'live' | 'reconnecting';

function Hero({
  stage,
  step,
  busy,
  locked,
  onStep,
  onAnalyze,
  onGenerate,
}: {
  stage: WorkStage;
  step: StepKey;
  busy: boolean;
  locked: boolean;
  onStep: (step: StepKey) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
}) {
  const content: {
    title: string;
    text: string;
    horizon: 'idle' | 'active' | 'calm';
    action?: React.ReactNode;
  } = (() => {
    switch (stage.kind) {
      case 'empty':
        return {
          title: 'Добавьте файлы клиента',
          text: 'Паспорт, СНИЛС, справки и выписки — Anyko прочитает их и найдёт сведения для документов.',
          horizon: 'idle',
          ...(step !== 'files' && {
            action: (
              <Button
                onClick={() => {
                  onStep('files');
                }}
              >
                К загрузке файлов <ArrowRight size={16} />
              </Button>
            ),
          }),
        };
      case 'ready':
        return {
          title: 'Файлы готовы — запустите извлечение',
          text: !stage.first
            ? `Новых файлов, ещё не прочитанных Anyko: ${String(stage.pending)}. Извлечение найдёт в них сведения и дополнит работу.`
            : 'Anyko распознает текст, изучит изображения и найдёт сведения с цитатами из источников.',
          horizon: 'idle',
          action: (
            <Button
              size="lg"
              loading={busy}
              disabled={locked}
              onClick={onAnalyze}
            >
              <Sparkles size={18} />
              Извлечь сведения
            </Button>
          ),
        };
      case 'processing':
        return {
          title: 'Anyko извлекает сведения',
          text: `Выполнено этапов: ${String(stage.done)} из ${String(stage.total)}. Можно закрыть страницу — обработка продолжится на сервере.`,
          horizon: 'active',
          ...(step !== 'extraction' && {
            action: (
              <Button
                variant="secondary"
                onClick={() => {
                  onStep('extraction');
                }}
              >
                Смотреть процесс <ArrowRight size={16} />
              </Button>
            ),
          }),
        };
      case 'review':
        return {
          title: stage.conflicts
            ? 'Проверьте сведения и разрешите расхождения'
            : 'Проверьте найденные сведения',
          text: `Найдено полей: ${String(stage.fields)}${stage.conflicts ? `, расхождений: ${String(stage.conflicts)}` : ''}. Примените значения, поправьте документы и подтвердите.${stage.run.status === 'partial' || stage.run.status === 'failed' ? ' Часть этапов извлечения не выполнена.' : ''}`,
          horizon: 'calm',
          action:
            step === 'review' ? (
              <Button
                onClick={() => {
                  onStep('documents');
                }}
              >
                Всё верно, дальше <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  onStep('review');
                }}
              >
                <FileSearch size={16} />
                Перейти к проверке
              </Button>
            ),
        };
      case 'confirmed':
        return {
          title: 'Сведения подтверждены',
          text: 'Осталось сформировать комплект документов в DOCX.',
          horizon: 'calm',
          action: (
            <Button
              size="lg"
              loading={busy}
              disabled={locked}
              onClick={onGenerate}
            >
              <PackageCheck size={18} />
              Сформировать комплект
            </Button>
          ),
        };
      case 'generating':
        return {
          title: 'Формируем документы',
          text: 'Anyko заполняет шаблоны. Файлы появятся автоматически.',
          horizon: 'active',
        };
      case 'generated':
        return {
          title: 'Комплект готов',
          text: `Сформировано документов: ${String(stage.files)}. Скачайте DOCX или вернитесь к сведениям, чтобы что-то поправить.`,
          horizon: 'calm',
          ...(step !== 'documents' && {
            action: (
              <Button
                onClick={() => {
                  onStep('documents');
                }}
              >
                <Download size={16} />К документам
              </Button>
            ),
          }),
        };
    }
  })();
  return (
    <section
      aria-live="polite"
      className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(70%_160%_at_0%_50%,#3a0b18,transparent_60%),linear-gradient(180deg,#131317,#0b0b0e)] p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <EventHorizon
        state={content.horizon}
        className="size-20 self-center sm:size-24"
      />
      <div className="min-w-0 flex-1">
        <p className="text-brand-hot text-xs font-semibold tracking-[0.14em] uppercase">
          Сейчас
        </p>
        <p className="font-heading mt-1 text-xl font-bold tracking-tight">
          {content.title}
        </p>
        <p className="text-muted mt-1.5 max-w-2xl text-sm leading-6">
          {content.text}
        </p>
      </div>
      {content.action && <div className="shrink-0">{content.action}</div>}
    </section>
  );
}

function Stepper({ current }: { current: StepKey }) {
  const currentIndex = journeySteps.findIndex((step) => step.key === current);
  return (
    <Tabs.List
      aria-label="Шаги работы"
      className="relative grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.07] bg-black/40 p-1.5 lg:grid-cols-4"
    >
      <Tabs.Indicator className="absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-xl bg-[linear-gradient(180deg,#ffffff12,#ffffff06)] shadow-[inset_0_1px_0_#ffffff14,0_0_0_1px_#ff3b6240,0_10px_30px_-12px_#db143c] transition-[translate,width,height] duration-300 ease-out" />
      {journeySteps.map((step, index) => {
        const done = index < currentIndex;
        const now = index === currentIndex;
        return (
          <Tabs.Tab
            key={step.key}
            value={step.key}
            className="group focus-visible:outline-brand-hot relative z-10 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2"
          >
            <span
              className={`relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${done ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : now ? 'border-[#ff3b62]/70 bg-[#db143c]/20 text-white shadow-[0_0_16px_-2px_#db143c]' : 'border-white/10 text-zinc-500'}`}
            >
              {now && (
                <span className="animate-horizon absolute -inset-1 rounded-full border border-[#ff3b62]/40" />
              )}
              {done ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="text-muted block text-sm font-medium transition-colors group-aria-selected:text-white">
                {step.title}
              </span>
              <span className="text-muted hidden truncate text-[11px] sm:block">
                {now ? 'Текущий шаг' : step.caption}
              </span>
            </span>
          </Tabs.Tab>
        );
      })}
    </Tabs.List>
  );
}

export function WorkDetail({
  workId,
  onUnauthorized,
}: {
  workId: string;
  onUnauthorized: () => void;
}) {
  const [view, setView] = useState<WorkView>();
  const [draft, setDraft] = useState<{
    values: FieldValues;
    revision: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState<Live>('connecting');
  const [step, setStep] = useState<StepKey>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [viewing, setViewing] = useState<ViewedDocument>();
  const loadVersion = useRef(0);
  const previousStage = useRef<WorkStage['kind']>(undefined);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const result = await requestApi(`/works/${workId}`, workResponseSchema);
      if (version !== loadVersion.current) return;
      setView(result);
      setLoadError('');
      if (result.cleanupPending) setDraft(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        onUnauthorized();
      else
        setLoadError(
          failure instanceof ApiError && failure.status === 404
            ? 'Работа не найдена.'
            : 'Не удалось обновить работу. Повторите попытку.',
        );
    }
  }, [workId, onUnauthorized]);
  useEffect(() => {
    let active = true;
    let events: EventSource | undefined;
    void requestApi(`/works/${workId}`, workResponseSchema)
      .then((initial) => {
        if (!active) return;
        setView(initial);
        events = new EventSource(
          `/api/works/${workId}/events?after=${initial.cursor}`,
        );
        events.addEventListener('changed', () => {
          void load();
        });
        events.onopen = () => {
          setLive('live');
          void load();
        };
        events.onerror = () => {
          setLive('reconnecting');
          void load();
        };
      })
      .catch(() => {
        if (active) void load();
      });
    return () => {
      active = false;
      loadVersion.current++;
      events?.close();
    };
  }, [workId, load]);
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
        onUnauthorized();
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
    const batch: Upload[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      state: 'uploading',
    }));
    const mark = (id: string, next: Partial<Upload>) => {
      setUploads((items) =>
        items.map((item) => (item.id === id ? { ...item, ...next } : item)),
      );
    };
    setUploads(batch);
    setPending(true);
    setError('');
    try {
      for (const [index, file] of files.entries()) {
        const id = batch[index]?.id ?? '';
        const data = new FormData();
        data.set('file', file);
        try {
          await requestApi(
            `/works/${workId}/documents`,
            documentResponseSchema,
            {
              method: 'POST',
              body: data,
              headers: { 'idempotency-key': crypto.randomUUID() },
              timeoutMs: 60000,
            },
          );
          mark(id, { state: 'done' });
        } catch (failure) {
          if (failure instanceof ApiError && failure.status === 401) {
            onUnauthorized();
            return;
          }
          mark(id, {
            state: 'failed',
            reason: uploadFailureMessage(file.name, failure),
          });
        }
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
        <EventHorizon state="calm" className="size-28" />
        <h1 className="font-heading mt-8 text-2xl font-bold">{loadError}</h1>
        <div className="mt-7 flex gap-3">
          <Link href="/" className="text-muted hover:text-ink self-center">
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
  const post = (path: string, value: unknown = {}) =>
    requestApi(`/works/${workId}/${path}`, accepted, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
  const analyze = () => {
    void command(() => post('analyze')).then((ok) => {
      if (ok) setStep('extraction');
    });
  };
  const generate = () => {
    void command(() => post('generate', { revision: view.work.revision })).then(
      (ok) => {
        if (ok) setStep('documents');
      },
    );
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
          href="/"
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
                await command(() =>
                  requestApi(`/works/${workId}/documents/${doc.id}`, accepted, {
                    method: 'DELETE',
                  }),
                );
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
                void command(() =>
                  requestApi(`/works/${workId}/confirm`, workResponseSchema, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ revision: view.work.revision }),
                  }),
                );
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
            className="animate-rise pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-[#ff3b62]/30 bg-[#141418]/95 p-3 pl-5 shadow-[0_20px_60px_-10px_#000,0_0_40px_-16px_#db143c] backdrop-blur-xl"
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
                  await requestApi(
                    `/works/${workId}/fields`,
                    workResponseSchema,
                    {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify(draft),
                    },
                  );
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
