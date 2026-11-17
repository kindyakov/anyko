import {
  AlertTriangle,
  Check,
  Crosshair,
  FileSearch,
  Quote,
} from 'lucide-react';

import type { FieldKey, FieldValues } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import { Button, stagger, StatusPill } from '@anyko/ui';

import { type ReviewField, same } from '@/features/fact-review/model/review';

import type { FactsForm } from '../facts-form';
import { CandidateValue } from '../work-fields';

export function CandidateList({
  visible,
  conflicts,
  applied,
  values,
  view,
  facts,
  busy,
  jump,
  onOpen,
}: {
  visible: ReviewField[];
  conflicts: Set<string>;
  applied: (key: FieldKey) => boolean;
  values: FieldValues;
  view: WorkView;
  facts: FactsForm;
  busy: boolean;
  jump: (key: FieldKey) => void;
  onOpen: (document: WorkView['documents'][number]) => void;
}) {
  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {visible.map(({ field, candidates }, index) => {
        const conflict = conflicts.has(field.key);
        const used = applied(field.key);
        return (
          <li
            key={field.key}
            className={`animate-rise rounded-2xl border p-4 sm:p-5 ${conflict ? 'glass border-amber-400/25 bg-amber-400/[0.03]' : 'glass border-white/[0.07]'} ${stagger(index)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium">{field.label}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conflict && (
                    <StatusPill tone="warning">Расхождение</StatusPill>
                  )}
                  {used ? (
                    <StatusPill tone="success">Применено</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Не применено</StatusPill>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  jump(field.key);
                }}
              >
                <Crosshair size={14} />
                Найти в документе
              </Button>
            </div>
            <ul className="mt-4 grid gap-2.5">
              {candidates.map((candidate, i) => {
                const current = same(values[field.key], candidate.value);
                return (
                  <li
                    key={i}
                    className={`rounded-xl border p-3.5 transition-colors ${current ? 'border-emerald-400/30 bg-emerald-400/[0.04]' : 'border-white/[0.07] bg-black/25'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <CandidateValue value={candidate.value} />
                        {candidate.origin === 'context' && (
                          <p className="text-muted mt-1 text-xs">
                            Предложено при сопоставлении файлов
                          </p>
                        )}
                      </div>
                      {current ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-300">
                          <Check size={14} /> Выбрано
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={conflict ? 'secondary' : 'primary'}
                          disabled={busy}
                          onClick={() => {
                            facts.change({
                              [field.key]: candidate.value,
                            });
                            jump(field.key);
                          }}
                        >
                          Применить
                        </Button>
                      )}
                    </div>
                    {candidate.evidence.map((source, j) => {
                      const doc = view.documents.find(
                        (item) => item.id === source.documentId,
                      );
                      return (
                        <figure
                          key={j}
                          className="mt-3 border-t border-white/[0.06] pt-3"
                        >
                          <blockquote className="flex gap-2 text-[13px] leading-5 text-zinc-300">
                            <Quote
                              size={13}
                              className="mt-0.5 shrink-0 text-[#ff6a88]"
                            />
                            <span className="wrap-anywhere">
                              {source.quote}
                            </span>
                          </blockquote>
                          <figcaption className="mt-1.5 pl-5">
                            {doc ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                className="max-w-full"
                                onClick={() => {
                                  onOpen(doc);
                                }}
                              >
                                <FileSearch size={13} />
                                <span className="truncate">
                                  {doc.filename}
                                  {source.imagePath && ' · изображение'}
                                </span>
                              </Button>
                            ) : (
                              <span className="text-muted text-xs">
                                Источник удалён
                              </span>
                            )}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
            {conflict && !used && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-200/80">
                <AlertTriangle size={13} />
                Файлы расходятся — выберите верный вариант или впишите своё
                значение в документе.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
