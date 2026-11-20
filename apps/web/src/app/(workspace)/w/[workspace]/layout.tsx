import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/lib/api/query-client';
import { sessionKeys } from '@/lib/api/session';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

import { AppShell } from './_shell/app-shell';

// Layout проверяет сессию у API и то, что область адреса есть среди участий. Он не перерисовывается
// при клиентской навигации, поэтому доступ к данным остаётся за API, а не за этой проверкой.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const session = await getSession();
  if (!session) redirect(routes.signIn());
  if (!session.memberships.some((item) => item.workspace.id === workspace))
    notFound();
  // Сессия передаётся клиенту через кэш запросов: оболочка читает её без повторного запроса.
  const client = createQueryClient();
  client.setQueryData(sessionKeys.all, session);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  );
}
