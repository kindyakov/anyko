import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

// Прежний адрес работы: переносит в её рабочую область, без сессии отправляет на вход с возвратом.
export default async function LegacyWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(routes.signIn(`/works/${encodeURIComponent(id)}`));
  redirect(routes.work(session.workspace.id, id));
}
