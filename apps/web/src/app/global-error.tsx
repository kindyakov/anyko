'use client';

import { errorReference } from '@/lib/error-reference';

// Заменяет корневой layout, поэтому задаёт html и body сам. Размещение и цвета повторяют корень.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const reference = errorReference(error);
  return (
    <html lang="ru" className="dark scheme-dark">
      <body className="bg-black font-sans text-white antialiased">
        <main id="main" className="grid min-h-dvh place-items-center px-5">
          <section className="flex max-w-md flex-col items-center text-center">
            <h1 className="text-2xl font-bold">Что-то пошло не так</h1>
            <p role="alert" className="mt-3 mb-7 leading-7 text-zinc-400">
              Страница не открылась. Повторите попытку.
              {reference && <> Код обращения: {reference}</>}
            </p>
            <button
              type="button"
              className="cursor-pointer rounded-xl bg-white px-5 py-3 font-medium text-black"
              onClick={() => {
                retry();
              }}
            >
              Повторить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
