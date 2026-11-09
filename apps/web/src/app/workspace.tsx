'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, RotateCw } from 'lucide-react';
import { useCallback, useState } from 'react';

import { sessionResponseSchema } from '@anyko/contracts';

import { AppShell, Logo } from '@/app/app-shell';
import { CosmicBackground } from '@/components/cosmos/cosmic-background';
import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { SignIn } from '@/features/auth';
import { expireSession } from '@/features/auth/session-cache';
import { DocumentWorkspace } from '@/features/documents';
import { WorkDetail, WorkList } from '@/features/works';
import { ApiError, requestApi } from '@/lib/api/client';

export function Workspace({
  workId,
  documents = false,
}: {
  workId?: string;
  documents?: boolean;
}) {
  const [motionPaused, setMotionPaused] = useState(false);
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
  if (query.isPending)
    return (
      <main
        id="main"
        className="grid min-h-dvh place-items-center bg-black"
        aria-busy
      >
        <span role="status" className="sr-only">
          Открываем рабочую область
        </span>
        <EventHorizon state="active" className="animate-fade size-44" />
      </main>
    );
  if (query.isError)
    return (
      <main
        id="main"
        className="grid min-h-dvh place-items-center bg-black px-5"
      >
        <section className="animate-rise flex max-w-md flex-col items-center text-center">
          <EventHorizon state="calm" className="mb-4 size-44" />
          <h1 className="font-heading text-2xl font-bold">
            Не удалось открыть рабочую область
          </h1>
          <p role="alert" className="text-muted mt-3 mb-7 leading-7">
            Сервер не ответил. Проверьте подключение и повторите попытку.
          </p>
          <Button
            size="lg"
            loading={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            <RotateCw size={17} />
            Повторить
          </Button>
        </section>
      </main>
    );
  if (!session)
    return (
      <div className="dark relative isolate min-h-dvh bg-black text-white">
        <CosmicBackground paused={motionPaused} />
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10 lg:px-12 lg:py-8">
          <Logo />
          <Button
            variant="secondary"
            size="icon"
            aria-label={
              motionPaused
                ? 'Включить анимацию фона'
                : 'Остановить анимацию фона'
            }
            aria-pressed={motionPaused}
            onClick={() => {
              setMotionPaused(!motionPaused);
            }}
          >
            {motionPaused ? <Play size={16} /> : <Pause size={16} />}
          </Button>
        </header>
        <main
          id="main"
          className="relative z-10 mx-auto flex min-h-[calc(100svh-94px)] max-w-[1800px] items-center justify-center px-5 pt-10 pb-16 sm:px-10 lg:min-h-[calc(100svh-118px)] lg:justify-end lg:px-16 lg:pt-0 xl:px-24"
        >
          <SignIn
            onSignedIn={() => {
              void query.refetch();
            }}
          />
        </main>
      </div>
    );
  return (
    <AppShell
      session={session}
      section={documents ? '/documents' : '/'}
      onUnauthorized={unauthorized}
    >
      {documents ? (
        <DocumentWorkspace onUnauthorized={unauthorized} />
      ) : workId ? (
        <WorkDetail
          key={workId}
          workId={workId}
          onUnauthorized={unauthorized}
        />
      ) : (
        <WorkList onUnauthorized={unauthorized} />
      )}
    </AppShell>
  );
}
