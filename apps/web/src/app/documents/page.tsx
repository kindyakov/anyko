import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

// Прежний адрес распознавания: переносит в рабочую область, без сессии — на вход с возвратом.
export default async function LegacyRecognitionPage() {
  const session = await getSession();
  if (!session) redirect(routes.signIn('/documents'));
  redirect(routes.recognition(session.workspace.id));
}
