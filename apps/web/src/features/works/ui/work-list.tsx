'use client';
import { Field } from '@base-ui/react/field';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, RotateCw, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  Button,
  Input,
  Modal,
  Notice,
  SegmentedControl,
  Skeleton,
} from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import { useCreateWork } from '@/features/works/api/mutations';
import {
  documentPackagesQueryOptions,
  worksQueryOptions,
} from '@/features/works/api/queries';
import { filterWorks } from '@/features/works/model/work-list';
import { useListPreferences } from '@/features/works/ui/list-preferences';
import { CreateWorkForm } from '@/features/works/ui/list/create-work-form';
import { Journey } from '@/features/works/ui/list/journey';
import { WorkCard } from '@/features/works/ui/list/work-card';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';

export function WorkList() {
  const titleRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const { search, filter, setSearch, setFilter } = useListPreferences();
  const workspaceId = useWorkspaceId();
  // Право только для отображения: без него создание не предлагается, а отказ даёт API.
  const canCreate = useCan('works.create');
  const list = useInfiniteQuery({
    ...worksQueryOptions(workspaceId),
    refetchOnMount: 'always',
  });
  const catalog = useQuery(documentPackagesQueryOptions(workspaceId));
  const create = useCreateWork(workspaceId);
  const works = list.data?.pages.flatMap((page) => page.works) ?? [];
  const visible = filterWorks(works, search, filter);
  const packages = catalog.data?.packages ?? [];
  const openCreate = () => {
    create.reset();
    setCreating(true);
  };
  return (
    <>
      <header className="animate-rise mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Работы
          </h1>
          <p className="text-muted mt-3 max-w-xl leading-7">
            Каждая работа — путь от файлов клиента к готовому комплекту
            документов. Загрузите файлы, проверьте сведения и скачайте DOCX.
          </p>
        </div>
        {canCreate && (
          <Button size="lg" className="w-full sm:w-auto" onClick={openCreate}>
            <Plus
              size={18}
              className="transition-transform duration-300 group-hover/button:rotate-90"
            />
            Новая работа
          </Button>
        )}
      </header>
      {(list.isPending || works.length > 0) && (
        <div className="animate-rise mb-6 flex flex-wrap items-center justify-between gap-3 [animation-delay:80ms]">
          <SegmentedControl
            label="Статус работы"
            value={filter}
            onValueChange={setFilter}
            items={[
              { value: 'all', label: 'Все', accessibleLabel: 'Все работы' },
              { value: 'draft', label: 'В работе' },
              { value: 'confirmed', label: 'Подтверждённые' },
            ]}
          />
          <Field.Root className="relative w-full min-w-0 sm:w-80">
            <Search
              size={16}
              className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            />
            <Input
              aria-label="Поиск по загруженным работам"
              placeholder="Найти работу"
              className="pr-11 pl-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
            {search && (
              <span className="absolute top-1 right-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Очистить поиск"
                  onClick={() => {
                    setSearch('');
                  }}
                >
                  <X size={15} />
                </Button>
              </span>
            )}
          </Field.Root>
        </div>
      )}
      {list.isPending ? (
        <ul
          className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
          aria-busy
          aria-label="Список работ загружается"
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <li
              key={item}
              className="glass rounded-3xl border border-white/[0.06] p-6"
            >
              <Skeleton className="size-11 rounded-xl" />
              <Skeleton className="mt-6 h-5 w-3/4" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-8 h-6 w-28 rounded-full" />
            </li>
          ))}
        </ul>
      ) : list.isError ? (
        <Notice
          tone="danger"
          role="alert"
          title="Не удалось загрузить работы"
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={list.isFetching}
              onClick={() => {
                void list.refetch();
              }}
            >
              <RotateCw size={15} />
              Повторить
            </Button>
          }
        >
          Проверьте подключение и попробуйте ещё раз.
        </Notice>
      ) : !works.length ? (
        <section className="animate-rise glass relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(90%_120%_at_50%_0%,#2a0a12aa,transparent_60%)] px-6 py-14 text-center sm:px-12">
          <EventHorizon state="idle" className="mx-auto size-56" />
          <h2 className="font-heading mt-8 text-2xl font-bold tracking-tight">
            Начните с первой работы
          </h2>
          <p className="text-muted mx-auto mt-3 max-w-md leading-7">
            Anyko поглотит файлы клиента, извлечёт сведения и заполнит комплект
            документов по шаблону.
          </p>
          {canCreate && (
            <Button size="lg" className="mt-8" onClick={openCreate}>
              <Plus size={18} />
              Создать работу
            </Button>
          )}
          <div className="mx-auto mt-12 max-w-3xl text-left">
            <Journey />
          </div>
        </section>
      ) : !visible.length ? (
        <section className="glass animate-rise flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
            <Search size={24} />
          </span>
          <h2 className="font-heading mt-5 text-xl font-bold">
            Работы не найдены
          </h2>
          <p className="text-muted mt-2 text-sm">
            Измените запрос или выберите другой статус.
          </p>
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
        </section>
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
          aria-label="Список работ"
        >
          {visible.map((work, index) => (
            <WorkCard
              key={work.id}
              work={work}
              index={index}
              packages={packages}
              workspaceId={workspaceId}
            />
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            variant="secondary"
            loading={list.isFetchingNextPage}
            onClick={() => {
              void list.fetchNextPage();
            }}
          >
            Показать ещё
            <ArrowRight size={16} />
          </Button>
          <p className="text-muted text-xs">
            Поиск и фильтр применяются к загруженным работам · показано{' '}
            {visible.length} из {works.length}
          </p>
        </div>
      )}
      <Modal
        open={creating}
        onOpenChange={setCreating}
        dismissible={!create.isPending}
        initialFocus={titleRef}
        title="Новая работа"
        description="Назовите работу и выберите комплект документов, который нужно подготовить."
      >
        {catalog.isPending ? (
          <div className="grid gap-4" aria-busy>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : catalog.isError ? (
          <Notice
            tone="danger"
            role="alert"
            title="Не удалось загрузить шаблоны"
            action={
              <Button
                variant="secondary"
                size="sm"
                loading={catalog.isFetching}
                onClick={() => {
                  void catalog.refetch();
                }}
              >
                Повторить
              </Button>
            }
          />
        ) : !packages.length ? (
          <Notice tone="neutral">
            Доступных комплектов пока нет. Обратитесь к владельцу рабочей
            области.
          </Notice>
        ) : (
          <CreateWorkForm
            create={create}
            packages={packages}
            titleRef={titleRef}
            onCancel={() => {
              setCreating(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}
