import type { ReactNode } from 'react';

import type { FieldValue } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

import { CandidateValue } from '../work-fields';

import { type Findings, FindingSources } from './finding-sources';
import type { OpenSource } from './source-fragments';

/**
 * Вариант значения для поля: само значение и действие стоят первыми,
 * объяснение и источники — под ними, отделённые линией.
 */
export function CandidateOption({
  number,
  value,
  findings,
  documents,
  action,
  onOpen,
}: {
  /** Номер варианта, когда их несколько; без него подпись не нужна. */
  number?: number | undefined;
  value: FieldValue;
  findings: Findings;
  documents: WorkView['documents'];
  action: ReactNode;
  onOpen: OpenSource;
}) {
  const label =
    number === undefined ? undefined : optionLabel(number, findings, documents);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] transition-colors hover:border-white/[0.14]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-3.5">
        <div className="min-w-0 flex-[1_1_14rem]">
          {label && (
            <p className="text-muted mb-1 flex min-w-0 items-center gap-1.5 text-xs">
              <span className="text-ink grid size-5 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-[11px] font-semibold tabular-nums">
                {number}
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </p>
          )}
          <div className="text-ink text-[15px] leading-6 font-medium">
            <CandidateValue value={value} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{action}</div>
      </div>
      <div className="border-t border-white/[0.06] px-3.5 py-3">
        <FindingSources
          findings={findings}
          documents={documents}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

/** «Вариант 2 · из Снилс.png» — откуда значение, чтобы варианты различались с первого взгляда. */
function optionLabel(
  number: number,
  findings: Findings,
  documents: WorkView['documents'],
) {
  const files = [
    ...new Set(
      findings.evidence.flatMap(({ documentId }) => {
        const filename = documents.find(
          ({ id }) => id === documentId,
        )?.filename;
        return filename ? [filename] : [];
      }),
    ),
  ];
  const source = files.length
    ? `из ${files.slice(0, 2).join(', ')}${files.length > 2 ? ` и ещё ${String(files.length - 2)}` : ''}`
    : findings.origin === 'inference'
      ? 'вывод агента'
      : findings.origin === 'context'
        ? 'сопоставление файлов'
        : undefined;
  return [`Вариант ${String(number)}`, source].filter(Boolean).join(' · ');
}
