import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';
import { lastWorkspaceCookie } from '@/lib/session-gate';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect(routes.signIn());
  // Последняя открытая область берётся, только если она совпадает с сессией. Список участий
  // появится в API позже: тогда выбор станет проверкой членства, а не сравнением с одной областью.
  const last = (await cookies()).get(lastWorkspaceCookie)?.value;
  const workspace = last === session.workspace.id ? last : session.workspace.id;
  redirect(routes.works(workspace));
}
