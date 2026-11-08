'use client';
import { Dialog } from '@base-ui/react/dialog';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
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
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Работы
          </h1>
          <p className="text-muted mt-1.5 text-sm leading-6">
            Подготовка заявлений и комплектов документов.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus size={17} />
          Новая работа
        </Button>
      </div>
      <section className="bg-surface overflow-hidden" aria-label="Список работ">
        <div className="border-line mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <SegmentedControl
            label="Статус работы"
            value={filter}
            onValueChange={setFilter}
            items={[
              { value: 'all', label: 'Все работы' },
              { value: 'draft', label: 'Черновики' },
              { value: 'confirmed', label: 'Подтверждённые' },
            ]}
          />
          <Field.Root className="relative min-w-0">
            <Search
              size={16}
              className="text-muted pointer-events-none absolute top-3.5 left-3"
            />
            <Input
              aria-label="Поиск по загруженным работам"
              placeholder="Найти работу…"
              className="w-full pl-10 sm:w-56"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </Field.Root>
        </div>
        {list.isPending ? (
          <p role="status" className="text-muted p-12 text-center">
            Загружаем работы…
          </p>
        ) : list.isError ? (
          <div role="alert" className="p-8">
            <p className="text-muted mb-4">Не удалось загрузить работы.</p>
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
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <FolderOpen
              size={36}
              strokeWidth={1.2}
              className="text-muted mb-5"
            />
            <h2 className="font-heading text-xl font-bold">
              {works.length ? 'Работы не найдены' : 'Начните с первой работы'}
            </h2>
            <p className="text-muted mt-3 max-w-sm text-sm leading-6">
              {works.length
                ? 'Измените запрос или выберите другой статус.'
                : 'Выберите пакет документов и добавьте исходные файлы клиента.'}
            </p>
            {!works.length && (
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
          <ul className="divide-line border-line divide-y border-t">
            {visible.map((work) => (
              <li key={work.id}>
                <Link
                  href={`/works/${work.id}`}
                  className="group hover:bg-canvas focus-visible:outline-brand flex items-center gap-4 px-5 py-5 transition-colors focus-visible:outline-2 sm:px-6"
                >
                  <span className="bg-canvas rounded-lg p-2.5">
                    <FileText size={20} className="text-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium wrap-anywhere">
                      {work.title}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      Изменено{' '}
                      {new Date(work.updatedAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <span className="text-muted bg-canvas hidden rounded-md px-2.5 py-1 text-xs sm:block">
                    {work.confirmedRevision === work.revision
                      ? 'Подтверждена'
                      : 'Черновик'}
                  </span>
                  <ArrowUpRight
                    size={17}
                    className="text-muted group-hover:text-ink"
                  />
                </Link>
              </li>
            ))}
          </ul>
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
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Popup className="border-line bg-surface text-ink fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-7 shadow-xl">
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
              <p role="status" className="mt-6">
                Загружаем шаблоны…
              </p>
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
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Создаём…' : 'Создать работу'}
                </Button>
              </Form>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
