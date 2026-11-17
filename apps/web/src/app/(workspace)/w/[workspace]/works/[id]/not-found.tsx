'use client';
import Link from 'next/link';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

export default function WorkNotFound() {
  const workspace = useWorkspaceId();
  return (
    <section className="animate-rise mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <EventHorizon state="calm" className="size-40" />
      <h1 className="font-heading mt-8 text-2xl font-bold">
        Работа не найдена.
      </h1>
      <div className="mt-7 flex gap-3">
        <Link
          href={routes.works(workspace)}
          className="text-muted hover:text-ink self-center"
        >
          Все работы
        </Link>
      </div>
    </section>
  );
}
