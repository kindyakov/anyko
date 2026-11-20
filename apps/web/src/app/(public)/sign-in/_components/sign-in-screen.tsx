'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@anyko/ui';
import { CosmicBackground } from '@anyko/ui/brand';

import { LogoLink } from '@/app/_components/logo-link';
import { SignIn } from '@/features/auth';
import { routes, safeNextPath } from '@/lib/routes';

export function SignInScreen({ next }: { next: string | undefined }) {
  const [motionPaused, setMotionPaused] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  return (
    <div className="dark relative isolate min-h-dvh bg-black text-white">
      <CosmicBackground paused={motionPaused} />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10 lg:px-12 lg:py-8">
        <LogoLink href={routes.home()} />
        <Button
          variant="secondary"
          size="icon"
          aria-label={
            motionPaused ? 'Включить анимацию фона' : 'Остановить анимацию фона'
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
            // Кэш от прошлой сессии (например, после истечения) не должен перекрыть новую.
            client.clear();
            router.replace(safeNextPath(next));
            router.refresh();
          }}
        />
      </main>
    </div>
  );
}
