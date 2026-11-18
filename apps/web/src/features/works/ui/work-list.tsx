'use client';
import { useQuery } from '@tanstack/react-query';
import { Plus, RotateCw, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { WorkPage } from '@anyko/contracts/works';
import { Button, Modal, Notice, Skeleton } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import { useCreateWork } from '@/features/works/api/mutations';
import {
  documentPackagesQueryOptions,
  worksQueryOptions,
} from '@/features/works/api/queries';
import {
  readWorkListParams,
  workListHref,
  type WorkListParams,
} from '@/features/works/model/work-list';
import { CreateWorkForm } from '@/features/works/ui/list/create-work-form';
import { Journey } from '@/features/works/ui/list/journey';
import { WorkCard } from '@/features/works/ui/list/work-card';
import { WorkDeletionDialog } from '@/features/works/ui/list/work-deletion-dialog';
import { WorkListControls } from '@/features/works/ui/list/work-list-controls';
import { WorkPagination } from '@/features/works/ui/list/work-pagination';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';

export function WorkList() {
  const titleRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkPage['items'][number]>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { page, pageSize, q, status, view } = readWorkListParams(searchParams);
  const workspaceId = useWorkspaceId();
  // Право только для отображения: без него создание не предлагается, а отказ даёт API.
  const canCreate = useCan('works.create');
  const canDelete = useCan('works.delete');
  const list = useQuery({
    ...worksQueryOptions(workspaceId, { page, pageSize, q, status }),
    refetchOnMount: 'always',
  });
  const catalog = useQuery(documentPackagesQueryOptions(workspaceId));
  const create = useCreateWork(workspaceId);
  const works = list.data?.items ?? [];
  const pagination = list.data;
  const pendingPage = list.isPending || list.isPlaceholderData;
  const hasFilters = q !== '' || status !== 'all';
  const packages = catalog.data?.packages ?? [];
  const change = useCallback(
    (changes: Partial<WorkListParams>, mode: 'push' | 'replace' = 'push') => {
      router[mode](
        workListHref(workspaceId, {
          page,
          pageSize,
          q,
          status,
          view,
          ...changes,
        }),
        { scroll: false },
      );
    },
    [router, workspaceId, page, pageSize, q, status, view],
  );
  useEffect(() => {
    if (!list.isPlaceholderData && pagination && pagination.page !== page)
      change({ page: pagination.page }, 'replace');
  }, [pagination, page, change, list.isPlaceholderData]);
  const openCreate = () => {
    create.reset();
    setCreating(true);
  };
  function navigatePage(next: number, size = pageSize) {
    change({ page: next, pageSize: size });
    window.scrollTo({ top: 0 });
  }
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
      {(pendingPage || works.length > 0 || hasFilters) && (
        <WorkListControls
          params={{ page, pageSize, q, status, view }}
          onChange={change}
        />
      )}
      {canDelete && (
        <WorkDeletionDialog
          key={workspaceId}
          workspaceId={workspaceId}
          target={deleting}
          pending={list.data?.deletions ?? []}
          onClose={() => {
            setDeleting(undefined);
          }}
        />
      )}
      {pendingPage ? (
        <ul
          className={
            view === 'tiles'
              ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3'
              : 'grid gap-3'
          }
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
      ) : !works.length && !hasFilters ? (
        <section className="animate-rise glass relative isolate overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(90%_120%_at_50%_0%,#2a0a12aa,transparent_60%)] px-6 py-14 text-center sm:px-12">
          <div className="relative -z-10 flex h-56 items-center justify-center">
            <EventHorizon
              state="idle"
              className="aspect-square w-full max-w-[28rem]"
            />
          </div>
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
      ) : !works.length ? (
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
              change({ page: 1, q: '', status: 'all' });
            }}
          >
            Сбросить фильтры
          </Button>
        </section>
      ) : (
        <ul
          className={
            view === 'tiles'
              ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3'
              : 'grid gap-3'
          }
          aria-label="Список работ"
        >
          {works.map((work, index) => (
            <WorkCard
              key={work.id}
              work={work}
              index={index}
              packages={packages}
              workspaceId={workspaceId}
              view={view}
              onDelete={
                canDelete
                  ? () => {
                      setDeleting(work);
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )}
      {pagination && pagination.total > 0 && (
        <WorkPagination
          total={pagination.total}
          page={list.isPlaceholderData ? page : pagination.page}
          pageSize={list.isPlaceholderData ? pageSize : pagination.pageSize}
          onPage={navigatePage}
          onPageSize={(size) => {
            navigatePage(1, size);
          }}
        />
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
