'use client';
import { Dialog } from '@base-ui/react/dialog';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  packagesResponseSchema,
  workResponseSchema,
  worksResponseSchema,
} from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { OrbitLoader } from '@/components/ui/orbit-loader';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { useListPreferences } from '@/features/works/list-preferences';
import { ApiError, requestApi } from '@/lib/api/client';

export function WorkList({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [creating, setCreating] = useState(false);
  const { search, filter, setSearch, setFilter } = useListPreferences();
  const list = useInfiniteQuery({
    queryKey: ['works'],
    refetchOnMount: 'always',
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      requestApi('/works', worksResponseSchema, {
        signal,
        ...(pageParam ? { query: { after: pageParam } } : {}),
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const catalog = useQuery({
    queryKey: ['document-packages'],
    queryFn: ({ signal }) =>
      requestApi('/document-packages', packagesResponseSchema, { signal }),
  });
  const create = useMutation({
    mutationFn: (data: FormData) =>
      requestApi('/works', workResponseSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: data.get('title'),
          packageVersion: data.get('packageVersion'),
        }),
      }),
    onSuccess: (result) => {
      window.location.assign(`/works/${result.work.id}`);
    },
  });
  const error = list.error ?? catalog.error ?? create.error;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) onUnauthorized();
  }, [error, onUnauthorized]);
  const works = list.data?.pages.flatMap((page) => page.works) ?? [];
  const visible = works.filter(
    (work) =>
      work.title
        .toLocaleLowerCase('ru')
        .includes(search.toLocaleLowerCase('ru')) &&
      (filter === 'all' ||
        (work.confirmedRevision === work.revision
          ? filter === 'confirmed'
          : filter === 'draft')),
  );
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
        <div>
          <p className="text-muted mb-3 flex items-center gap-2 text-xs font-medium">
            <span className="bg-brand size-1.5 rounded-full" aria-hidden />
            Рабочая область
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Работы
          </h1>
          <p className="text-muted mt-3 max-w-lg text-sm leading-6">
            От исходных файлов до готового комплекта документов.
          </p>
        </div>
        <Button
          className="w-full rounded-xl shadow-[0_4px_24px_-8px_#db143c70] sm:w-auto"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus size={17} />
          Новая работа
        </Button>
      </div>
      <section
        className="border-line bg-surface overflow-hidden rounded-2xl border shadow-xs"
        aria-label="Список работ"
      >
        <div className="border-line flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5">
          <SegmentedControl
            label="Статус работы"
            value={filter}
            onValueChange={setFilter}
            items={[
              { value: 'all', label: 'Все', accessibleLabel: 'Все работы' },
              { value: 'draft', label: 'Черновики' },
              { value: 'confirmed', label: 'Подтверждённые' },
            ]}
          />
          <Field.Root className="relative w-full min-w-0 xl:w-72">
            <Search
              size={16}
              className="text-muted pointer-events-none absolute top-3.5 left-3.5"
            />
            <Input
              aria-label="Поиск по загруженным работам"
              placeholder="Найти работу…"
              className="w-full rounded-xl pr-12 pl-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
            {search && (
              <Button
                variant="secondary"
                aria-label="Очистить поиск"
                className="absolute top-0 right-0 min-h-11 border-transparent bg-transparent px-3"
                onClick={() => {
                  setSearch('');
                }}
              >
                <X size={15} />
              </Button>
            )}
          </Field.Root>
        </div>
        {list.isPending ? (
          <div className="py-20">
            <OrbitLoader label="Загружаем работы…" />
          </div>
        ) : list.isError ? (
          <div
            role="alert"
            className="flex flex-col items-center px-6 py-16 text-center"
          >
            <FolderOpen size={28} className="text-muted mb-4" />
            <h2 className="font-heading text-lg font-semibold">
              Не удалось загрузить работы
            </h2>
            <p className="text-muted mt-2 mb-6 text-sm">
              Проверьте подключение и попробуйте ещё раз.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                void list.refetch();
              }}
            >
              Повторить
            </Button>
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <span className="border-brand/15 bg-tint text-brand mb-6 flex size-16 items-center justify-center rounded-2xl border">
              {works.length ? (
                <Search size={26} strokeWidth={1.5} />
              ) : (
                <FolderOpen size={28} strokeWidth={1.5} />
              )}
            </span>
            <h2 className="font-heading text-xl font-semibold">
              {works.length ? 'Работы не найдены' : 'Начните с первой работы'}
            </h2>
            <p className="text-muted mt-3 max-w-sm text-sm leading-6">
              {works.length
                ? 'Измените запрос или выберите другой статус.'
                : 'Выберите пакет документов и добавьте исходные файлы клиента.'}
            </p>
            {works.length ? (
              <Button
                variant="secondary"
                className="mt-6"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Сбросить фильтры
              </Button>
            ) : (
              <Button
                className="mt-6"
                onClick={() => {
                  setCreating(true);
                }}
              >
                <Plus size={16} />
                Создать работу
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className="text-muted border-line bg-canvas/40 hidden grid-cols-[minmax(0,1fr)_150px_150px_24px] items-center gap-6 border-b px-6 py-3 text-xs lg:grid"
            >
              <span>Название и пакет документов</span>
              <span>Статус</span>
              <span>Изменено</span>
              <span />
            </div>
            <ul className="divide-line divide-y">
              {visible.map((work) => {
                const confirmed = work.confirmedRevision === work.revision;
                const pack = catalog.data?.packages.find(
                  (item) => item.version === work.packageVersion,
                );
                return (
                  <li key={work.id}>
                    <Link
                      href={`/works/${work.id}`}
                      className="group hover:bg-tint/50 focus-visible:outline-brand grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-3 px-4 py-5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_150px_150px_24px] lg:gap-6"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="border-line bg-canvas text-muted group-hover:border-brand/25 group-hover:text-brand hidden size-11 shrink-0 items-center justify-center rounded-xl border transition-colors sm:flex">
                          <FileText size={20} strokeWidth={1.5} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm leading-6 font-medium wrap-anywhere">
                            {work.title}
                          </p>
                          <p className="text-muted mt-1 text-xs leading-5 wrap-anywhere">
                            {pack?.title ?? 'Комплект документов'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`col-start-1 row-start-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs lg:col-auto lg:row-auto ${confirmed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-canvas text-muted ring-line ring-1 ring-inset'}`}
                      >
                        {confirmed ? (
                          <Check size={12} />
                        ) : (
                          <span
                            className="size-1.5 rounded-full bg-current opacity-60"
                            aria-hidden
                          />
                        )}
                        {confirmed ? 'Подтверждена' : 'Черновик'}
                      </span>
                      <time
                        dateTime={work.updatedAt}
                        className="text-muted col-start-1 row-start-3 text-xs tabular-nums lg:col-auto lg:row-auto"
                      >
                        <span className="lg:hidden">Изменено </span>
                        {new Date(work.updatedAt).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <span className="ml-2 opacity-70 lg:mt-1 lg:ml-0 lg:block">
                          {new Date(work.updatedAt).toLocaleTimeString(
                            'ru-RU',
                            { hour: '2-digit', minute: '2-digit' },
                          )}
                        </span>
                      </time>
                      <ArrowRight
                        size={17}
                        className="text-muted group-hover:text-brand col-start-2 row-start-1 transition-transform motion-safe:group-hover:translate-x-1 lg:col-auto lg:row-auto"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {!list.isPending && !list.isError && works.length > 0 && (
          <div
            className="border-line text-muted border-t px-5 py-3 text-xs"
            role="status"
          >
            Показано: {visible.length} из {works.length}
            {list.hasNextPage ? ' загруженных' : ''}
          </div>
        )}
        {list.hasNextPage && (
          <div className="border-line border-t p-5">
            <p className="text-muted mb-3 text-xs">
              Поиск и фильтр применяются к загруженным работам.
            </p>
            <Button
              variant="secondary"
              disabled={list.isFetchingNextPage}
              onClick={() => {
                void list.fetchNextPage();
              }}
            >
              {list.isFetchingNextPage && (
                <OrbitLoader compact label="Загружаем работы" />
              )}
              {list.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
            </Button>
          </div>
        )}
      </section>
      <Dialog.Root
        open={creating}
        onOpenChange={(open) => {
          if (!create.isPending) setCreating(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
          <Dialog.Popup className="border-line bg-surface text-ink fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-6 shadow-2xl transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="font-heading text-2xl font-bold">
                Новая работа
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    variant="secondary"
                    aria-label="Закрыть"
                    disabled={create.isPending}
                  />
                }
              >
                <X size={16} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="text-muted mt-3 text-sm leading-6">
              Назовите работу и выберите пакет документов.
            </Dialog.Description>
            {catalog.isPending ? (
              <div className="py-10">
                <OrbitLoader label="Загружаем шаблоны…" />
              </div>
            ) : catalog.isError ? (
              <div role="alert" className="mt-6">
                <p>Не удалось загрузить шаблоны.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void catalog.refetch();
                  }}
                >
                  Повторить
                </Button>
              </div>
            ) : !catalog.data.packages.length ? (
              <p className="text-muted mt-6 text-sm">
                Доступных пакетов пока нет. Обратитесь к владельцу рабочей
                области.
              </p>
            ) : (
              <Form
                className="mt-6 grid gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!create.isPending)
                    create.mutate(new FormData(event.currentTarget));
                }}
              >
                <FormField label="Название работы">
                  <Input
                    name="title"
                    required
                    maxLength={200}
                    placeholder="Например, заявление клиента"
                    disabled={create.isPending}
                  />
                </FormField>
                <FormField label="Пакет документов">
                  <Select
                    name="packageVersion"
                    disabled={create.isPending}
                    items={catalog.data.packages.map((pack) => ({
                      value: pack.version,
                      label:
                        pack.title +
                        (pack.technical ? ' (проверочный бланк)' : ''),
                    }))}
                  />
                </FormField>
                {create.isError && (
                  <p
                    role="alert"
                    className="text-sm text-red-700 dark:text-red-300"
                  >
                    Не удалось создать работу. Попробуйте снова.
                  </p>
                )}
                <div className="border-line mt-2 flex flex-wrap justify-end gap-3 border-t pt-6">
                  <Dialog.Close
                    render={
                      <Button variant="secondary" disabled={create.isPending} />
                    }
                  >
                    Отмена
                  </Dialog.Close>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? (
                      <OrbitLoader compact label="Создаём работу" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {create.isPending ? 'Создаём…' : 'Создать работу'}
                  </Button>
                </div>
              </Form>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
