import { Sparkles } from 'lucide-react';

import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  familyStatementNeedsReview,
  statementDefaultValue,
} from '@anyko/document-values/bankruptcy-projection';
import {
  canApplyCreditorRegistryCandidate,
  containsCreditorRegistryCandidate,
} from '@anyko/document-values/obligations';
import { isDatedBankruptcyPackage } from '@anyko/document-values/statement-layout';
import { Button, StatusPill } from '@anyko/ui';

import { courtOptions } from '@/features/fact-review/model/court-options';
import { sameFieldValue } from '@/features/fact-review/model/field-value';
import {
  candidateSelection,
  invalidReviewValue,
  normalizedReviewValue,
  reviewCandidateValue,
  type ReviewField,
  sameReviewValue,
} from '@/features/fact-review/model/review';

import { CandidateOption } from './candidate-option';
import { CourtChoices } from './court-choices';
import { CurrentCandidateValue } from './current-candidate-value';
import { FieldCardHeader } from './field-card-header';
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
          const defaultText = isDatedBankruptcyPackage(view.package.version)
            ? statementDefaultValue(values, field.key)
            : undefined;
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
                group.origin === origin && sameReviewValue(group.value, value),
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
              sameReviewValue(comparable, group.value) &&
              !choicesFor(group).length
                ? 'matching'
                : 'options',
          );

          const apply = (
            option: (typeof options)[number],
            target: HTMLElement,
          ) => {
            target
              .closest('article')
              ?.querySelector('h3')
              ?.focus({ preventScroll: true });
            onApply({
              [field.key]: reviewCandidateValue(
                field.key,
                current,
                option.value,
                option.creditorSources.size > 0,
              ),
            });
          };

          return (
            <li key={field.key}>
              <article
                aria-labelledby={`review-field-${field.key}`}
                className={`glass relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${attention ? 'border-amber-400/15' : 'border-white/[0.07]'}`}
              >
                {attention && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1 bg-amber-400/70"
                  />
                )}
                <FieldCardHeader
                  id={`review-field-${field.key}`}
                  label={field.label}
                  filled={
                    !!defaultText ||
                    (current != null &&
                      !(typeof current === 'string' && !current.trim()))
                  }
                  conflict={conflict}
                  evidenceLost={evidenceLost}
                  onJump={() => {
                    jump(field.key);
                  }}
                />
                <CurrentCandidateValue
                  value={current}
                  defaultText={defaultText}
                  changed={changed}
                  evidenceLost={evidenceLost}
                  busy={busy}
                  emptyHint={
                    options.length
                      ? 'Пусто — выберите вариант ниже'
                      : 'Пусто — в файлах значение не найдено'
                  }
                  onConfirmDefault={(text) => {
                    onApply({ [field.key]: text });
                  }}
                >
                  {field.key === 'familyDetails' &&
                    typeof current === 'string' &&
                    familyStatementNeedsReview(current) && (
                      <p className="mt-2 text-sm text-amber-200" role="status">
                        Проверьте формулировку от первого лица.
                      </p>
                    )}
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
                </CurrentCandidateValue>
                {options.length > 0 && (
                  <section
                    className="mt-5 space-y-2.5"
                    aria-label="Варианты модели"
                  >
                    <p className="text-muted flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                      <Sparkles size={13} aria-hidden />
                      {matching.length
                        ? 'Другие варианты модели'
                        : 'Варианты модели'}
                      <span className="tabular-nums">· {options.length}</span>
                    </p>
                    {options.length > 1 && (
                      <p className="text-sm text-amber-100/90">
                        {matching.length
                          ? 'В файлах есть и другие значения — проверьте, какое верное.'
                          : 'Файлы расходятся — выберите верное значение.'}
                      </p>
                    )}
                    {options.map((option, index) => (
                      <CandidateOption
                        number={options.length > 1 ? index + 1 : undefined}
                        key={index}
                        value={option.value}
                        findings={option}
                        documents={view.documents}
                        onOpen={onOpen}
                        action={
                          option.courtSources.size ? (
                            <CourtChoices
                              field={field.key}
                              choices={choicesFor(option)}
                              busy={busy}
                              primary={current == null && options.length === 1}
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
                                current == null && options.length === 1
                                  ? 'primary'
                                  : 'secondary'
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
                                apply(option, event.currentTarget);
                              }}
                            >
                              Подставить это значение
                            </Button>
                          )
                        }
                      />
                    ))}
                  </section>
                )}
                {evidenceLost && (
                  <p className="mt-3 text-xs text-zinc-500">
                    Часть исходных фрагментов больше недоступна. Сверьте
                    значение с актуальными файлами.
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
