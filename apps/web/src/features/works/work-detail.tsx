'use client';
import { Form } from '@base-ui/react/form';
import { Tabs } from '@base-ui/react/tabs';
import { Download, Files, History, ScanText } from 'lucide-react';
import Link from 'next/link';
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';

import {
  documentResponseSchema,
  type FieldValues,
  workResponseSchema,
  type WorkView,
} from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PackagePreview } from '@/features/works/package-preview';
import { SessionContext } from '@/features/works/session-context';
import { SourcePreview } from '@/features/works/source-preview';
import {
  UploadFailure,
  uploadFailureMessage,
} from '@/features/works/upload-errors';
import { CandidateValue } from '@/features/works/work-fields';
import { ApiError, requestApi } from '@/lib/api/client';

const accepted = z.object({ status: z.string() });
const statuses: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Готово',
  failed: 'Ошибка',
  partial: 'Частично готово',
  cancelled: 'Остановлено',
  skipped: 'Не требуется',
};
const stages: Record<string, string> = {
  parsing: 'Парсинг и OCR',
  vision: 'Анализ изображений',
  extraction: 'Извлечение фактов',
  reconciliation: 'Сопоставление сведений',
  generation: 'Формирование DOCX',
};
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
  const [streamState, setStreamState] = useState('Подключение событий…');
  const loadVersion = useRef(0);
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
          setStreamState('Статусы обновляются автоматически');
          void load();
        };
        events.onerror = () => {
          setStreamState('Переподключаем события. Состояние работы сохранено.');
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
  async function command(operation: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await operation();
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        onUnauthorized();
      else
        setError(
          failure instanceof ApiError && failure.code === 'REVISION_CONFLICT'
            ? 'Работа изменилась. Ваши правки сохранены в полях. Обновите основу правок перед повторным сохранением.'
            : failure instanceof UploadFailure
              ? failure.message
              : failure instanceof ApiError
                ? `Операция не выполнена: ${failure.code}`
                : 'Операция не выполнена. Повторите попытку.',
        );
    } finally {
      setPending(false);
    }
  }
  async function upload(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = new FormData(form).getAll('files');
    await command(async () => {
      const failed: string[] = [];
      for (const file of files)
        if (file instanceof File && file.size) {
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
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 401)
              throw failure;
            failed.push(uploadFailureMessage(file.name, failure));
          }
        }
      if (failed.length) throw new UploadFailure(failed.join(' '));
      form.reset();
    });
  }
  if (!view)
    return (
      <section className="bg-surface my-5">
        <p role="status">{error || loadError || 'Открываем работу…'}</p>
        <Button
          onClick={() => {
            void load();
          }}
        >
          Повторить
        </Button>
      </section>
    );
  const busy = pending || view.cleanupPending;
  const active = view.runs.some(
    (run) => run.status === 'queued' || run.status === 'running',
  );
  const values = draft?.values ?? view.facts.values;
  const post = (path: string, value: unknown = {}) =>
    requestApi(`/works/${workId}/${path}`, accepted, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
  return (
    <>
      <Link href="/" className="text-muted hover:text-ink text-xs">
        ← Все работы
      </Link>
      <h1 className="font-heading mt-4 mb-2 text-2xl font-semibold tracking-tight">
        {view.work.title}
      </h1>
      <p className="text-muted text-sm leading-6" role="status">
        {streamState}
      </p>
      {(error || loadError) && (
        <div
          className="my-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error || loadError}
        </div>
      )}
      {view.cleanupPending && (
        <p
          className="my-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="status"
        >
          Удаляем данные исходника и производные результаты. Документ временно
          недоступен.
        </p>
      )}
      {draft && (
        <div className="border-line bg-surface sticky top-0 z-20 my-4 rounded-xl border p-4 shadow-sm">
          <p role="status">Есть несохранённые изменения</p>
          <div className="my-4 flex flex-wrap items-center gap-3">
            <Button
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
              Сохранить поля
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setDraft(null);
              }}
            >
              Отменить правки
            </Button>
            {draft.revision !== view.work.revision && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft({
                    values: draft.values,
                    revision: view.work.revision,
                  });
                }}
              >
                Применить мои поля к текущей версии
              </Button>
            )}
          </div>
        </div>
      )}
      <Tabs.Root defaultValue="sources" className="mt-6">
        <Tabs.List
          className="border-line mb-6 grid grid-cols-2 gap-1 border-b xl:flex"
          aria-label="Разделы работы"
        >
          {[
            { value: 'sources', label: 'Исходные файлы', Icon: Files },
            { value: 'review', label: 'Сведения и документы', Icon: ScanText },
            { value: 'history', label: 'История обработки', Icon: History },
            { value: 'result', label: 'Готовые документы', Icon: Download },
          ].map(({ value, label, Icon }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="text-muted hover:text-ink aria-selected:border-brand aria-selected:text-ink focus-visible:outline-brand flex min-h-12 min-w-0 items-center gap-2 border-b-2 border-transparent px-2 py-2 text-left text-sm transition-colors focus-visible:outline-2 sm:px-4"
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="sources" keepMounted>
          {' '}
          <section className="bg-surface my-5">
            <h2 className="font-heading mb-3 text-base font-semibold">
              Исходные файлы
            </h2>
            <p className="text-muted text-sm leading-6">
              До 20 файлов. Удаление исходника также очищает извлечённые
              сведения и сформированные документы этой работы.
            </p>
            <Form
              className="border-line bg-canvas mt-5 flex flex-col gap-5 rounded-xl border border-dashed p-6 sm:flex-row sm:items-end sm:justify-between"
              onSubmit={(event) => {
                void upload(event);
              }}
            >
              <FormField
                className="grid gap-2 text-sm font-medium"
                label={<>PDF, DOCX или фотографии </>}
              >
                <Input
                  className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
                  name="files"
                  type="file"
                  multiple
                  required
                  accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff"
                  disabled={busy || active}
                />
              </FormField>
              <Button type="submit" disabled={busy || active}>
                Загрузить
              </Button>
            </Form>
            <ul className="divide-line mt-5 divide-y [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:gap-4 [&>li]:py-5">
              {view.documents.map((doc) => (
                <li key={doc.id}>
                  <div className="grid min-w-0 flex-1 gap-2 wrap-anywhere">
                    <a
                      href={`/api/documents/${doc.id}/source`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {doc.filename}
                    </a>
                    <span className="border-line bg-canvas text-muted w-fit rounded-full border px-3 py-1 text-xs">
                      {statuses[doc.status]}
                    </span>
                    {doc.status === 'succeeded' && (
                      <SourcePreview
                        key={`${doc.id}-${String(view.work.inputRevision)}`}
                        documentId={doc.id}
                      />
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setDraft(null);
                      void command(() =>
                        requestApi(
                          `/works/${workId}/documents/${doc.id}`,
                          accepted,
                          {
                            method: 'DELETE',
                          },
                        ),
                      );
                    }}
                  >
                    Удалить полностью
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              disabled={busy || active || !view.documents.length}
              onClick={() => {
                void command(() => post('analyze'));
              }}
            >
              {view.runs.length ? 'Повторить обработку' : 'Извлечь сведения'}
            </Button>
          </section>
        </Tabs.Panel>
        <Tabs.Panel value="review">
          {' '}
          <SessionContext
            session={view.session ?? null}
            revision={view.work.revision}
            fields={view.package.fields}
          />
          <section className="bg-surface my-5">
            <h2 className="font-heading mb-3 text-base font-semibold">
              Извлечённые варианты и источники
            </h2>
            {!view.facts.candidates.length && (
              <p className="text-muted text-sm leading-6">
                После анализа здесь появятся сведения с подтверждающими
                фрагментами.
              </p>
            )}
            {view.package.fields
              .filter((field) =>
                view.facts.candidates.some(
                  (candidate) => candidate.field === field.key,
                ),
              )
              .map((field) => (
                <Disclosure
                  className="border-line [&_blockquote]:border-line my-4 rounded-xl border p-4 text-sm [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4"
                  key={field.key}
                  title={<>{field.label}</>}
                >
                  {view.facts.candidates
                    .filter((candidate) => candidate.field === field.key)
                    .map((candidate, index) => (
                      <div key={index}>
                        {candidate.origin === 'context' && (
                          <p className="text-muted text-sm leading-6">
                            Предложено при сопоставлении документов
                          </p>
                        )}
                        <CandidateValue value={candidate.value} />
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setDraft({
                              revision: draft?.revision ?? view.work.revision,
                              values: {
                                ...values,
                                [field.key]: candidate.value,
                              },
                            });
                          }}
                        >
                          Использовать этот вариант
                        </Button>
                        {candidate.evidence.map((source, i) => (
                          <blockquote key={i}>
                            <a
                              href={
                                '/api/documents/' +
                                source.documentId +
                                '/source'
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {view.documents.find(
                                (doc) => doc.id === source.documentId,
                              )?.filename ?? 'Источник'}
                              {source.imagePath && ' · ' + source.imagePath}
                            </a>
                            <p>{source.quote}</p>
                          </blockquote>
                        ))}
                      </div>
                    ))}
                </Disclosure>
              ))}
          </section>
          <PackagePreview
            pack={view.package}
            values={values}
            disabled={busy}
            onChange={(key, value) => {
              setDraft({
                revision: draft?.revision ?? view.work.revision,
                values: { ...values, [key]: value },
              });
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="history">
          {' '}
          <section className="bg-surface my-5">
            <h2 className="font-heading mb-3 text-base font-semibold">
              Обработка
            </h2>
            {!view.runs.length && (
              <p className="text-muted text-sm leading-6">
                После загрузки запустите извлечение сведений.
              </p>
            )}
            {view.runs.slice(0, 5).map((run) => (
              <Disclosure
                key={run.id}
                defaultOpen={
                  run.status === 'running' ||
                  run.status === 'partial' ||
                  run.status === 'failed'
                }
                title={
                  <>
                    {run.kind === 'analysis'
                      ? 'Анализ файлов'
                      : 'Создание документа'}{' '}
                    · {statuses[run.status]}
                  </>
                }
              >
                <ul>
                  {run.steps.map((step) => (
                    <li key={step.id}>
                      {stages[step.stage]}{' '}
                      {step.documentId &&
                        `· ${view.documents.find((doc) => doc.id === step.documentId)?.filename ?? 'исходник'}`}{' '}
                      — {statuses[step.status]}
                      {step.errorCode && ` (${step.errorCode})`}
                      {step.stage === 'vision' &&
                        step.visuals.map((visual) => (
                          <Disclosure
                            key={visual.path}
                            title={<>{visual.path}</>}
                          >
                            {step.documentId && (
                              <a
                                href={`/api/documents/${step.documentId}/source`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Исходный файл
                              </a>
                            )}
                            {step.documentId &&
                              visual.imageIndex !== undefined && (
                                <img
                                  src={`/api/documents/${step.documentId}/images/${String(visual.imageIndex)}`}
                                  alt="Исходное изображение для анализа"
                                  loading="lazy"
                                  className="block max-h-[360px] max-w-full object-contain"
                                />
                              )}
                            <p>{visual.description}</p>
                          </Disclosure>
                        ))}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ))}
          </section>
        </Tabs.Panel>
        <Tabs.Panel value="result">
          {' '}
          <section className="bg-surface my-5">
            <p>
              {view.work.confirmedRevision === view.work.revision
                ? 'Работа подтверждена'
                : 'Сведения требуют вашей проверки'}
            </p>
            <div className="my-4 flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || active || !!draft}
                onClick={() => {
                  void command(() =>
                    requestApi(`/works/${workId}/confirm`, workResponseSchema, {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ revision: view.work.revision }),
                    }),
                  );
                }}
              >
                Подтвердить работу целиком
              </Button>
              <Button
                variant="secondary"
                disabled={busy || active || !!draft}
                onClick={() => {
                  void command(() =>
                    post('generate', { revision: view.work.revision }),
                  );
                }}
              >
                Сформировать комплект DOCX
              </Button>
            </div>
            <ul>
              {view.generations.map((generation) => (
                <li key={generation.id}>
                  {generation.confirmed ? 'Документ' : 'Черновик'} · версия{' '}
                  {generation.revision} · {statuses[generation.status]}{' '}
                  <ul>
                    {generation.files.map((file) => (
                      <li key={file.id}>
                        {file.title} · {statuses[file.status]}{' '}
                        {file.status === 'succeeded' && (
                          <a
                            href={
                              '/api/works/' +
                              workId +
                              '/generations/' +
                              generation.id +
                              '/files/' +
                              file.id
                            }
                          >
                            Скачать DOCX
                          </a>
                        )}
                        {file.errorCode && (
                          <span role="status">
                            Не удалось сформировать этот документ. Можно создать
                            комплект повторно.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </Tabs.Panel>
      </Tabs.Root>
    </>
  );
}
