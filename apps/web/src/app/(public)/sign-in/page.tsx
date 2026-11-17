import { redirect } from 'next/navigation';

import { safeNextPath } from '@/lib/routes';
import { getSession } from '@/lib/server/session';

import { SignInScreen } from './_components/sign-in-screen';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = typeof next === 'string' ? next : undefined;
  if (await getSession()) redirect(safeNextPath(target));
  return <SignInScreen next={target} />;
}
