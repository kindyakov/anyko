'use client';
import { Dialog } from '@base-ui/react/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ChevronRight,
  Files,
  FolderOpen,
  Pause,
  Play,
  Settings2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { sessionResponseSchema } from '@anyko/contracts';

import { CosmicBackground } from '@/components/cosmos/cosmic-background';
import { Button } from '@/components/ui/button';
import { OrbitLoader } from '@/components/ui/orbit-loader';
import { SignIn, SignOut } from '@/features/auth';
import { expireSession } from '@/features/auth/session-cache';
import { DocumentWorkspace } from '@/features/documents';
import { LlmSettings, WorkDetail, WorkList } from '@/features/works';
import { ApiError, requestApi } from '@/lib/api/client';

export function Workspace({
  workId,
  documents = false,
}: {
  workId?: string;
  documents?: boolean;
}) {
  const [motionPaused, setMotionPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      try {
        return await requestApi('/session', sessionResponseSchema, { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: false,
  });
  const session = query.data;
  const unauthorized = useCallback(() => {
    expireSession(client);
  }, [client]);
  const logo = (
    <Link
      href="/"
      aria-label="Anyko, главная"
      className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight"
    >
      <img src="/brand/anyko-mark-source.svg" width="32" height="32" alt="" />
      anyko
      <span className="bg-brand ml-0.5 size-1.5 rounded-full" />
    </Link>
  );
  return (
    <div
      className={
        session
          ? 'bg-canvas min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]'
          : 'dark relative isolate min-h-dvh bg-black text-white [--canvas:#09090b] [--ink:#fafafa] [--line:#27272a] [--muted:#a1a1aa] [--surface:#111113] [--tint:#201114]'
      }
    >
      {!session && <CosmicBackground paused={motionPaused} />}
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:p-4"
      >
        К содержимому
      </a>
      {session ? (
        <aside className="border-line bg-surface/40 flex flex-col border-b md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-r md:border-b-0">
          <div className="flex h-20 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
            {logo}
            <div className="flex gap-2 md:hidden">
              <Button
                variant="secondary"
                aria-label="Настройки"
                className="px-3"
                onClick={() => {
                  setSettingsOpen(true);
                }}
              >
                <Settings2 size={16} />
              </Button>
              <SignOut onSignedOut={unauthorized} />
            </div>
          </div>
          <div className="border-line mx-5 mt-3 mb-7 hidden items-center gap-3 border-b pb-6 md:flex">
            <span className="bg-tint text-brand ring-brand/15 flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ring-1">
              {session.workspace.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {session.workspace.name}
              </p>
              <p className="text-muted mt-0.5 text-[11px]">
                Рабочее пространство
              </p>
            </div>
          </div>
          <p className="text-muted mb-3 hidden px-6 text-[10px] font-medium tracking-[0.14em] uppercase md:block">
            Пространство
          </p>
          <nav
            aria-label="Основная навигация"
            className="flex gap-1.5 px-4 pb-4 md:flex-col"
          >
            {[
              {
                href: '/',
                label: 'Работы',
                Icon: FolderOpen,
                active: !documents,
              },
              {
                href: '/documents',
                label: 'Исходные файлы',
                Icon: Files,
                active: documents,
              },
            ].map(({ href, label, Icon, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`focus-visible:outline-brand flex min-h-11 flex-1 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 md:flex-none ${active ? 'bg-tint text-ink ring-brand/15 font-medium ring-1 ring-inset' : 'text-muted hover:bg-surface hover:text-ink'}`}
              >
                <Icon
                  size={17}
                  className={active ? 'text-brand' : ''}
                  aria-hidden
                />
                {label}
                {active && (
                  <span className="bg-brand ml-auto hidden h-4 w-0.5 rounded-full md:block" />
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden space-y-4 px-4 pt-8 pb-5 md:block">
            <Button
              variant="secondary"
              className="text-muted w-full justify-start rounded-xl border-transparent bg-transparent"
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              <Settings2 size={17} />
              Настройки
            </Button>
            <div className="border-line flex items-center justify-between gap-2 border-t pt-4">
              <div className="min-w-0 pl-1">
                <p className="truncate text-xs font-medium">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-muted mt-1 text-[11px]">Участник команды</p>
              </div>
              <SignOut onSignedOut={unauthorized} />
            </div>
          </div>
        </aside>
      ) : (
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10 lg:px-12 lg:py-8">
          {logo}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              aria-label={
                motionPaused
                  ? 'Включить анимацию фона'
                  : 'Остановить анимацию фона'
              }
              aria-pressed={motionPaused}
              className="border-white/10 bg-black/40 px-3 text-zinc-400 backdrop-blur-md hover:text-white"
              onClick={() => {
                setMotionPaused(!motionPaused);
              }}
            >
              {motionPaused ? <Play size={16} /> : <Pause size={16} />}
            </Button>
          </div>
        </header>
      )}
      <div className={session ? 'min-w-0' : 'relative z-10 min-w-0'}>
        {session && (
          <header className="border-line hidden min-h-16 items-center justify-between gap-3 border-b px-5 text-xs md:flex md:px-8 lg:px-10">
            <div className="text-muted flex min-w-0 items-center gap-2">
              <span className="hidden max-w-48 truncate sm:block">
                {session.workspace.name}
              </span>
              <ChevronRight size={13} className="hidden shrink-0 sm:block" />
              <span className="text-ink shrink-0">
                {documents
                  ? 'Исходные файлы'
                  : workId
                    ? 'Работа'
                    : 'Все работы'}
              </span>
            </div>
            <span className="text-muted hidden items-center gap-2 md:flex">
              <span className="bg-brand/70 size-1 rounded-full" aria-hidden />
              Каждый факт на своём месте
            </span>
          </header>
        )}
        <main
          id="main"
          className={
            session
              ? 'mx-auto max-w-[1440px] min-w-0 px-4 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12'
              : 'mx-auto flex min-h-[calc(100svh-94px)] max-w-[1800px] items-center justify-center px-5 pt-10 pb-16 sm:px-10 lg:min-h-[calc(100svh-118px)] lg:justify-end lg:px-16 lg:pt-0 xl:px-24'
          }
        >
          {query.isPending ? (
            <div className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
              <OrbitLoader label="Открываем рабочую область…" />
            </div>
          ) : query.isError ? (
            <section className="border-line bg-surface mx-auto my-16 max-w-lg rounded-2xl border p-8">
              <h1 className="font-heading text-2xl font-bold">
                Не удалось открыть рабочую область
              </h1>
              <p role="alert" className="text-muted my-4">
                Проверьте подключение к серверу и повторите попытку.
              </p>
              <Button
                onClick={() => {
                  void query.refetch();
                }}
              >
                Повторить <ArrowUpRight size={16} />
              </Button>
            </section>
          ) : session ? (
            documents ? (
              <DocumentWorkspace onUnauthorized={unauthorized} />
            ) : workId ? (
              <WorkDetail workId={workId} onUnauthorized={unauthorized} />
            ) : (
              <WorkList onUnauthorized={unauthorized} />
            )
          ) : (
            <SignIn
              onSignedIn={() => {
                void query.refetch();
              }}
            />
          )}
        </main>
      </div>
      {session && (
        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Popup className="border-line bg-surface text-ink fixed top-0 right-0 z-50 h-dvh w-full max-w-lg overflow-y-auto border-l p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-heading text-xl font-semibold">
                  Настройки пространства
                </Dialog.Title>
                <Dialog.Close
                  render={
                    <Button
                      variant="secondary"
                      aria-label="Закрыть настройки"
                    />
                  }
                >
                  <X size={16} />
                </Dialog.Close>
              </div>
              <Dialog.Description className="text-muted my-4 text-sm">
                Подключение модели для работы с документами.
              </Dialog.Description>
              <LlmSettings />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
