import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';
import { lastWorkspaceCookie } from '@/lib/session-gate';
import { pickWorkspace } from '@/lib/workspace-choice';

// `/` ведёт в последнюю открытую область, если пользователь в ней участвует; иначе в первую из участий.
// Без участий — экран «Нет доступа», а не цикл редиректов.
export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect(routes.signIn());
  const last = (await cookies()).get(lastWorkspaceCookie)?.value;
  const workspace = pickWorkspace(session.memberships, last);
  redirect(
    workspace === undefined ? routes.noWorkspace() : routes.works(workspace),
  );
}
