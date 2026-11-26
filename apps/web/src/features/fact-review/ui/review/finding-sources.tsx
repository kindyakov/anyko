import { ExternalLink, FileText, GitMerge, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import type { WorkView } from '@anyko/contracts/works';

import type { ReviewField } from '@/features/fact-review/model/review';

import {
  type Evidence,
  type OpenSource,
  SourceFragments,
} from './source-fragments';

type Origin = NonNullable<ReviewField['candidates'][number]['origin']>;
export type CourtSources = NonNullable<
  ReviewField['candidates'][number]['courtSources']
>;
export type CreditorSource = NonNullable<
  ReviewField['candidates'][number]['creditorSource']
>;
const formatSourceDate = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export type Findings = {
  origin: Origin;
  evidence: Evidence[];
  explanations: Set<string>;
  courtSources: Map<string, CourtSources>;
  creditorSources: Map<string, CreditorSource>;
};

const origins: Record<
  Origin,
  { label: string; icon: typeof FileText; className: string }
> = {
  document: {
    label: 'Из документа',
    icon: FileText,
    className: 'text-emerald-300',
  },
  context: {
    label: 'Сопоставление файлов',
    icon: GitMerge,
    className: 'text-sky-300',
  },
  inference: {
    label: 'Вывод агента',
    icon: Sparkles,
    className: 'text-amber-300',
  },
};

/** Внешняя ссылка-источник: заметна в покое и откликается на наведение. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-visible:outline-brand-hot inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-medium text-rose-200 transition-colors hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
      <ExternalLink size={12} aria-hidden className="opacity-70" />
    </a>
  );
}

function Checked({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-muted text-xs">
      проверено {formatSourceDate.format(new Date(at))}
    </time>
  );
}

export function FindingSources({
  findings,
  documents,
  onOpen,
}: {
  findings: Findings;
  documents: WorkView['documents'];
  onOpen: OpenSource;
}) {
  const isInference = findings.origin === 'inference';
  const origin = origins[findings.origin];
  const OriginIcon = origin.icon;
  return (
    <div className="space-y-2.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 font-semibold ${origin.className}`}
        >
          <OriginIcon size={13} aria-hidden />
          {origin.label}
        </span>
        {isInference &&
          findings.courtSources.size === 0 &&
          findings.creditorSources.size === 0 && (
            <span className="text-muted">Без независимой проверки</span>
          )}
      </p>
      {[...findings.explanations].map((explanation) => (
        <p
          key={explanation}
          className="text-sm leading-6 break-words text-white/85"
        >
          {explanation}
        </p>
      ))}
      {[...findings.courtSources.values()].map(
        ({ catalogueUrl, contactUrl, checkedAt }) => (
          <div key={contactUrl} className="flex flex-wrap items-center gap-2">
            <SourceLink href={catalogueUrl}>
              Каталог арбитражных судов
            </SourceLink>
            <SourceLink href={contactUrl}>Контакты суда</SourceLink>
            <Checked at={checkedAt} />
          </div>
        ),
      )}
      {[...findings.creditorSources.values()].map(
        ({ registry, url, checkedAt }) => (
          <div key={url} className="flex flex-wrap items-center gap-2">
            <SourceLink href={url}>
              {registry === 'cbr'
                ? 'Реестр Банка России'
                : 'ЕГРЮЛ (ФНС России)'}
            </SourceLink>
            <Checked at={checkedAt} />
          </div>
        ),
      )}
      <SourceFragments
        evidence={findings.evidence}
        documents={documents}
        onOpen={onOpen}
        {...(isInference && { title: 'Основания для вывода' })}
      />
    </div>
  );
}
