import type { WorkView } from '@anyko/contracts/works';
import { StatusPill } from '@anyko/ui';

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
const formatSourceDate = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export type Findings = {
  origin: Origin;
  evidence: Evidence[];
  explanations: Set<string>;
  courtSources: Map<string, CourtSources>;
};

const originLabels: Record<Origin, string> = {
  document: 'Из документа',
  context: 'Сопоставление файлов',
  inference: 'Вывод агента',
};

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
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={isInference ? 'warning' : 'success'}>
          {originLabels[findings.origin]}
        </StatusPill>
        {isInference && findings.courtSources.size === 0 && (
          <span className="text-xs text-white/70">
            Без независимой проверки
          </span>
        )}
      </div>
      {[...findings.explanations].map((explanation) => (
        <p
          key={explanation}
          className="text-sm leading-5 break-words text-white/85"
        >
          {explanation}
        </p>
      ))}
      {[...findings.courtSources.values()].map(
        ({ catalogueUrl, contactUrl, checkedAt }) => (
          <div
            key={contactUrl}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/75"
          >
            <a
              href={catalogueUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Каталог арбитражных судов
            </a>
            <a
              href={contactUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Контакты суда
            </a>
            <time dateTime={checkedAt}>
              Проверено {formatSourceDate.format(new Date(checkedAt))}
            </time>
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
