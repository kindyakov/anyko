import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

// Прежний адрес распознавания: переносит в первую рабочую область сессии, без сессии — на вход
// с возвратом, без участий — на экран «Нет доступа».
export default async function LegacyRecognitionPage() {
  const session = await getSession();
  if (!session) redirect(routes.signIn('/documents'));
  const first = session.memberships[0];
  if (!first) redirect(routes.noWorkspace());
  redirect(routes.recognition(first.workspace.id));
}
