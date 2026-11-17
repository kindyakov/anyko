import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

// Прежний адрес работы: переносит в первую рабочую область сессии, без сессии отправляет на вход
// с возвратом, без участий — на экран «Нет доступа».
export default async function LegacyWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(routes.signIn(`/works/${encodeURIComponent(id)}`));
  const first = session.memberships[0];
  if (!first) redirect(routes.noWorkspace());
  redirect(routes.work(first.workspace.id, id));
}
