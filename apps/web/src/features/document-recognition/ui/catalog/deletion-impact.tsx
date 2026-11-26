import { BriefcaseBusiness, History, ListChecks, Unlink } from 'lucide-react';
import { useId } from 'react';

import type { getDocumentDeletionImpact } from '@anyko/contracts/documents';
import { StatusPill } from '@anyko/ui';

import type { callApi } from '@/lib/api/call';

type Affected = {
  id: string;
  filename: string;
  works: Awaited<
    ReturnType<typeof callApi<typeof getDocumentDeletionImpact>>
  >['works'];
};

const consequences = [
  { Icon: Unlink, text: 'Работы потеряют этот источник.' },
  {
    Icon: ListChecks,
    text: 'Значения без доказательств сохранятся для проверки.',
  },
  { Icon: History, text: 'Сформированные DOCX останутся в истории.' },
];

/** Работы, которые потеряют удаляемые источники, и что с ними станет. */
export function DeletionImpact({
  affected,
  grouped,
}: {
  affected: Affected[];
  grouped: boolean;
}) {
  const heading = useId();
  const count = new Set(
    affected.flatMap(({ works }) => works.map(({ id }) => id)),
  ).size;
  return (
    <>
      <section
        aria-labelledby={heading}
        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
          <h3
            id={heading}
            className="text-muted text-xs font-semibold tracking-[0.08em] uppercase"
          >
            Затронуто работ
          </h3>
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-200 tabular-nums ring-1 ring-red-400/25 ring-inset">
            {count}
          </span>
        </header>
        <ul
          aria-label="Затронутые работы"
          className="max-h-44 overflow-y-auto py-1.5"
        >
          {affected.map(({ id, filename, works }) => (
            <li key={id}>
              {grouped && (
                <p className="text-muted truncate px-4 pt-2 pb-1 text-xs">
                  {filename}
                </p>
              )}
              <ul>
                {works.map((work) => (
                  <li
                    key={work.id}
                    className="flex min-h-10 items-center gap-3 px-4 py-1.5"
                  >
                    <BriefcaseBusiness
                      size={16}
                      className="text-muted shrink-0"
                      aria-hidden
                    />
                    <span
                      className="text-ink min-w-0 flex-1 truncate text-sm font-medium"
                      title={work.title}
                    >
                      {work.title}
                    </span>
                    {work.busy && (
                      <StatusPill tone="progress">идёт обработка</StatusPill>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <ul className="text-muted grid gap-2 text-sm leading-6">
        {consequences.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5">
            <Icon
              size={16}
              className="mt-1 shrink-0 text-zinc-500"
              aria-hidden
            />
            {text}
          </li>
        ))}
      </ul>
    </>
  );
}
