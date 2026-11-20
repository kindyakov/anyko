import Link from 'next/link';

import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <main
      id="main"
      className="grid min-h-dvh place-items-center bg-black px-5 text-white"
    >
      <section className="flex max-w-md flex-col items-center text-center">
        <h1 className="font-heading text-2xl font-bold">Страница не найдена</h1>
        <Link
          href={routes.home()}
          className="text-muted hover:text-ink mt-6 text-sm"
        >
          На главную
        </Link>
      </section>
    </main>
  );
}
