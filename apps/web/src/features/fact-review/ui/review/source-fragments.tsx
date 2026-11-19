import { FileSearch } from 'lucide-react';

import type { WorkView } from '@anyko/contracts/works';
import { Button, Disclosure } from '@anyko/ui';

export type Evidence =
  WorkView['facts']['candidates'][number]['evidence'][number];
export type OpenSource = (
  document: WorkView['documents'][number],
  page?: number,
) => void;

export function SourceFragments({
  evidence,
  documents,
  onOpen,
  title = 'Фрагменты для сверки',
}: {
  evidence: Evidence[];
  documents: WorkView['documents'];
  onOpen: OpenSource;
  title?: string;
}) {
  const unique = new Map(evidence.map((item) => [JSON.stringify(item), item]));
  const byDocument = Map.groupBy(
    unique.values(),
    ({ documentId }) => documentId,
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-white/65">{title}</p>
      {[...byDocument].map(([documentId, [first, ...rest]]) => {
        if (!first) return null;
        const file = documents.find(({ id }) => id === documentId);
        return (
          <div
            key={documentId}
            className="rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2"
          >
            <p className="mb-1 flex items-start gap-2 text-xs font-semibold break-words text-white/85">
              <FileSearch
                size={14}
                className="shrink-0 text-rose-200"
                aria-hidden
              />
              <span className="min-w-0 wrap-anywhere">
                {file?.filename ?? 'Файл недоступен'}
              </span>
            </p>
            <SourceQuote source={first} file={file} onOpen={onOpen} />
            {rest.length > 0 && (
              <Disclosure
                className="mt-2 border-t border-white/[0.08] text-rose-200"
                title={`Ещё из этого файла · ${String(rest.length)}`}
              >
                <ul className="divide-y divide-white/[0.08]">
                  {rest.map((source, index) => (
                    <li key={index} className="py-1.5">
                      <SourceQuote
                        source={source}
                        file={file}
                        onOpen={onOpen}
                      />
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceQuote({
  source,
  file,
  onOpen,
}: {
  source: Evidence;
  file: WorkView['documents'][number] | undefined;
  onOpen: OpenSource;
}) {
  const action = source.page
    ? `Открыть стр. ${String(source.page)}`
    : 'Открыть файл';
  return (
    <figure className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <blockquote className="min-w-0 flex-[1_1_12rem] border-l-2 border-rose-200/25 pl-2.5 text-sm leading-5 wrap-anywhere text-zinc-300">
        {source.quote}
      </blockquote>
      {file && (
        <Button
          variant="ghost"
          size="xs"
          className="text-rose-200"
          aria-label={`${action} — ${file.filename}`}
          onClick={() => {
            onOpen(file, source.page);
          }}
        >
          {action}
        </Button>
      )}
    </figure>
  );
}
