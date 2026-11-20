import { Crosshair } from 'lucide-react';

import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  canApplyCreditorRegistryCandidate,
  containsCreditorRegistryCandidate,
} from '@anyko/document-values/obligations';
import { Button, StatusPill } from '@anyko/ui';

import { courtOptions } from '@/features/fact-review/model/court-options';
import { sameFieldValue } from '@/features/fact-review/model/field-value';
import {
  candidateSelection,
  invalidReviewValue,
  normalizedReviewValue,
  reviewCandidateValue,
  type ReviewField,
} from '@/features/fact-review/model/review';

import { CandidateValue } from '../work-fields';

import { CourtChoices } from './court-choices';
import {
  type CourtSources,
  type CreditorSource,
  type Findings,
  FindingSources,
} from './finding-sources';
import type { OpenSource } from './source-fragments';

export function CandidateList({
  visible,
  values,
  view,
  busy,
  jump,
  onApply,
  onOpen,
}: {
  visible: ReviewField[];
  values: FieldValues;
  view: WorkView;
  busy: boolean;
  jump: (key: FieldKey) => void;
  onApply: (patch: Partial<FieldValues>) => void;
  onOpen: OpenSource;
}) {
  return (
    <ul className="grid gap-3">
      {visible.map(
        ({ field, candidates, conflict, evidenceLost, attention }) => {
          const saved = view.facts.values[field.key];
          const current = values[field.key];
          const changed = !sameFieldValue(current, saved);
          const comparable = normalizedReviewValue(field, current);
          const isSelected = candidateSelection(
            comparable,
            normalizedReviewValue(field, saved),
          );
          const groups: (Findings & {
            value: FieldValue;
            included: boolean;
          })[] = [];

          for (const candidate of candidates) {
            const origin = candidate.origin ?? 'document';
            const value = normalizedReviewValue(field, candidate.value);
            const existing = groups.find(
              (group) =>
                group.origin === origin && sameFieldValue(group.value, value),
            );
            const group = existing ?? {
              origin,
              value,
              included: false,
              evidence: [],
              explanations: new Set<string>(),
              courtSources: new Map<string, CourtSources>(),
              creditorSources: new Map<string, CreditorSource>(),
            };
            if (!existing) groups.push(group);
            group.included ||= candidate.creditorSource
              ? containsCreditorRegistryCandidate(comparable, value)
              : isSelected({ ...candidate, value });
            if (candidate.creditorSource)
              group.creditorSources.set(
                candidate.creditorSource.url,
                candidate.creditorSource,
              );
            group.evidence.push(...candidate.evidence);
            if (candidate.explanation)
              group.explanations.add(candidate.explanation);
            if (candidate.courtSources)
              group.courtSources.set(
                JSON.stringify([
                  candidate.courtSources.contactUrl,
                  candidate.courtSources.courtName,
                ]),
                candidate.courtSources,
              );
          }
          const choicesFor = (group: Findings & { value: FieldValue }) =>
            courtOptions(
              values,
              view.facts.candidates,
              field.key,
              group.value,
              group.courtSources.values(),
            );
          const { matching = [], options = [] } = Object.groupBy(
            groups,
            (group) =>
              !invalidReviewValue(field, group.value) &&
              sameFieldValue(comparable, group.value) &&
              !choicesFor(group).length
                ? 'matching'
                : 'options',
          );

          return (
            <li key={field.key}>
              <article
                aria-labelledby={`review-field-${field.key}`}
                className={`glass rounded-2xl border p-4 sm:p-5 ${attention ? 'border-amber-400/25' : 'border-white/[0.08]'}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id={`review-field-${field.key}`}
                      tabIndex={-1}
                      className="inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8da4]"
                    >
                      <span className="text-xs font-medium text-white/65">
                        Поле
                      </span>
                      <span className="h-3 w-px bg-white/20" aria-hidden />
                      {field.label}
                    </h3>
                    {evidenceLost && (
                      <StatusPill tone="warning">
                        Нужна повторная сверка
                      </StatusPill>
                    )}
                    {conflict && (
                      <StatusPill tone="warning">Расхождение</StatusPill>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      jump(field.key);
                    }}
                  >
                    <Crosshair size={14} aria-hidden />
                    Показать поле в документе
                  </Button>
                </header>
                <div
                  className={`mt-3 rounded-xl border px-3.5 py-3 ${current != null && !evidenceLost ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-white/[0.08] bg-black/20'}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-xs font-medium text-white/70">
                      В документ подставится
                    </p>
                    {changed && (
                      <span className="text-xs text-amber-200" role="status">
                        Не сохранено
                      </span>
                    )}
                  </div>
                  <div className="text-base leading-6 font-semibold break-words">
                    {current == null ? (
                      <span className="text-white/65">Пока не заполнено</span>
                    ) : Array.isArray(current) && current.length === 0 ? (
                      <span>Записей нет</span>
                    ) : (
                      <CandidateValue value={current} />
                    )}
                  </div>
                  {matching.map((findings, index) => (
                    <div
                      key={index}
                      className="mt-3 border-t border-white/[0.08] pt-3"
                    >
                      <FindingSources
                        findings={findings}
                        documents={view.documents}
                        onOpen={onOpen}
                      />
                    </div>
                  ))}
                </div>
                {options.length > 0 && (
                  <section
                    className="mt-4 space-y-2"
                    aria-label="Варианты модели"
                  >
                    <p className="text-xs font-medium text-white/70">
                      {matching.length
                        ? 'Другие варианты модели'
                        : 'Варианты модели'}
                    </p>
                    {options.map((option, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/[0.08] bg-black/20 p-3.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2.5">
                          <div className="min-w-0 text-sm font-medium">
                            <CandidateValue value={option.value} />
                          </div>
                          {option.courtSources.size ? (
                            <CourtChoices
                              field={field.key}
                              choices={choicesFor(option)}
                              busy={busy}
                              onApply={onApply}
                            />
                          ) : invalidReviewValue(field, option.value) ? (
                            <StatusPill tone="warning">
                              {field.valueType === 'date'
                                ? 'Непроверенная дата'
                                : 'Непроверенная сумма'}
                            </StatusPill>
                          ) : option.included ? (
                            <StatusPill tone="success">
                              Совпадает полностью или частично
                            </StatusPill>
                          ) : (
                            <Button
                              size="sm"
                              variant={
                                current == null ? 'primary' : 'secondary'
                              }
                              disabled={
                                busy ||
                                (option.creditorSources.size > 0 &&
                                  !canApplyCreditorRegistryCandidate(
                                    current,
                                    option.value,
                                  ))
                              }
                              onClick={(event) => {
                                event.currentTarget
                                  .closest('article')
                                  ?.querySelector('h3')
                                  ?.focus({ preventScroll: true });
                                const value = reviewCandidateValue(
                                  field.key,
                                  current,
                                  option.value,
                                  option.creditorSources.size > 0,
                                );
                                onApply({ [field.key]: value });
                              }}
                            >
                              Подставить это значение
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 border-t border-white/[0.08] pt-3">
                          <FindingSources
                            findings={option}
                            documents={view.documents}
                            onOpen={onOpen}
                          />
                        </div>
                      </div>
                    ))}
                  </section>
                )}
                {(evidenceLost || !candidates.length) && (
                  <p className="text-muted mt-2 text-xs">
                    {evidenceLost
                      ? 'Часть исходных фрагментов больше недоступна. Сверьте значение с актуальными файлами.'
                      : 'В файлах модель не нашла значения для этого поля.'}
                  </p>
                )}
              </article>
            </li>
          );
        },
      )}
    </ul>
  );
}
