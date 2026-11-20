import { redirect } from 'next/navigation';

import { LogoLink } from '@/app/_components/logo-link';
import { SignOut } from '@/features/auth';
import { routes } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

// Сессия есть, а участий в рабочих областях нет: показываем, что доступа нет, и даём выйти.
// Без сессии экран недоступен, с участиями — ведёт в приложение.
export default async function NoWorkspacePage() {
  const session = await getSession();
  if (!session) redirect(routes.signIn());
  if (session.memberships.length > 0) redirect(routes.home());
  return (
    <main
      id="main"
      className="bg-canvas text-ink relative isolate grid min-h-dvh place-items-center px-6 py-16"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <LogoLink href={routes.home()} />
        <section className="glass rounded-3xl border border-white/[0.08] p-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Нет доступа к рабочим областям
          </h1>
          <p className="text-muted mt-3 leading-7">
            Попросите владельца рабочей области пригласить вас.
          </p>
          <div className="mt-7 flex items-center justify-between gap-4">
            <p className="text-muted truncate text-sm">
              {session.user.name || session.user.email}
            </p>
            <SignOut />
          </div>
        </section>
      </div>
    </main>
  );
}
