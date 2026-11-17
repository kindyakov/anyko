'use client';
import { Field } from '@base-ui/react/field';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  FileStack,
  FolderKanban,
  Plus,
  RotateCw,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import type { DocumentPackage } from '@anyko/contracts/catalog';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { FormErrorNotice, FormRoot, useAppForm } from '@/components/ui/form';
import { HoverMist } from '@/components/ui/hover-mist';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RelativeTime } from '@/components/ui/relative-time';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { stagger } from '@/components/ui/stagger';
import { Notice, StatusPill } from '@/components/ui/status';
import { useCreateWork } from '@/features/works/api/mutations';
import {
  documentPackagesQueryOptions,
  worksQueryOptions,
} from '@/features/works/api/queries';
import { useListPreferences } from '@/features/works/list-preferences';
import { journeySteps } from '@/features/works/model/journey';
import { ApiError } from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/api/form-errors';
import { useExpireSession } from '@/lib/api/query-client';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

function Journey({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-4'}`}
    >
      {journeySteps.map((step, index) => (
        <li
          key={step.key}
          className={`animate-rise glass relative rounded-2xl border border-white/[0.07] p-3.5 ${stagger(index * 2)}`}
        >
          <span className="font-heading text-brand-hot text-xs font-bold">
            0{index + 1}
          </span>
          <p className="mt-1 text-sm font-medium">{step.title}</p>
          <p className="text-muted mt-0.5 text-xs leading-5">{step.caption}</p>
        </li>
      ))}
    </ol>
  );
}

const createFailure = 'Не удалось создать работу. Попробуйте снова.';
const createWorkTexts = { fallback: createFailure, technical: createFailure };

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Введите название работы')
  .max(200, 'Не больше 200 символов');
const packageSchema = z.string().min(1, 'Выберите комплект документов');

function CreateWorkForm({
  create,
  packages,
  titleRef,
  onCancel,
}: {
  create: ReturnType<typeof useCreateWork>;
  packages: readonly DocumentPackage[];
  titleRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}) {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const form = useAppForm({
    defaultValues: { title: '', packageVersion: packages[0]?.version ?? '' },
    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await create.mutateAsync(value);
        router.push(routes.work(workspaceId, result.work.id));
      } catch (error) {
        applyServerErrors(formApi, error, createWorkTexts);
      }
    },
  });
  return (
    <FormRoot form={form} className="grid gap-6">
      <form.AppField name="title" validators={{ onChange: titleSchema }}>
        {(field) => (
          <field.TextField
            ref={titleRef}
            label="Название работы"
            required
            maxLength={200}
            placeholder="Например, Иванов И. И. — банкротство"
          />
        )}
      </form.AppField>
      <form.AppField
        name="packageVersion"
        validators={{ onChange: packageSchema }}
      >
        {(field) => (
          <field.RadioGroupField
            label="Комплект документов"
            options={packages.map((pack) => ({
              value: pack.version,
              children: (
                <>
                  <span className="block text-sm font-medium">
                    {pack.title}
                    {pack.technical && (
                      <span className="text-muted ml-2 text-xs font-normal">
                        проверочный бланк
                      </span>
                    )}
                  </span>
                  <span className="text-muted mt-1 block text-xs leading-5">
                    {pack.documents.map((doc) => doc.title).join(' · ')}
                  </span>
                </>
              ),
            }))}
          />
        )}
      </form.AppField>
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <p className="text-muted mb-3 flex items-center gap-2 text-xs">
          <FolderKanban size={14} />
          Что будет дальше
        </p>
        <Journey compact />
      </div>
      <FormErrorNotice form={form} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="secondary"
          disabled={create.isPending}
          onClick={onCancel}
        >
          Отмена
        </Button>
        <form.SubmitButton>
          Создать и открыть
          <ArrowRight size={16} />
        </form.SubmitButton>
      </div>
    </FormRoot>
  );
}

export function WorkList() {
  const expireSession = useExpireSession();
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
  const create = useCreateWork();
  const error = list.error ?? catalog.error ?? create.error;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) expireSession();
  }, [error, expireSession]);
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
          {visible.map((work, index) => {
            const confirmed = work.confirmedRevision === work.revision;
            const pack = packages.find(
              (item) => item.version === work.packageVersion,
            );
            return (
              <li key={work.id} className={`animate-rise ${stagger(index)}`}>
                <Link
                  href={routes.work(workspaceId, work.id)}
                  className="group group/mist focus-visible:outline-brand-hot glass relative isolate flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] p-6 transition-[border-color,box-shadow] duration-500 ease-out hover:border-[#ff3b62]/40 hover:shadow-[0_20px_60px_-20px_#db143c88] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <HoverMist />
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors duration-300 group-hover:border-[#ff3b62]/40 group-hover:text-[#ff6a88]">
                      <FileStack size={20} strokeWidth={1.6} />
                    </span>
                    <ArrowUpRight
                      size={20}
                      className="text-muted transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                    />
                  </div>
                  <h2 className="font-heading mt-6 text-lg leading-snug font-bold tracking-tight wrap-anywhere">
                    {work.title}
                  </h2>
                  <p className="text-muted mt-1.5 text-sm leading-6 wrap-anywhere">
                    {pack?.title ?? 'Комплект документов'}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-7">
                    {confirmed ? (
                      <StatusPill tone="success">Подтверждена</StatusPill>
                    ) : (
                      <StatusPill tone="brand">В работе</StatusPill>
                    )}
                    <span className="text-muted text-xs">
                      Изменена <RelativeTime value={work.updatedAt} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
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
