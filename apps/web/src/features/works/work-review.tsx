'use client';
import {
  AlertTriangle,
  Check,
  Crosshair,
  FileSearch,
  Quote,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';

import type {
  FieldKey,
  FieldValue,
  FieldValues,
  WorkView,
} from '@anyko/contracts';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { stagger } from '@/components/ui/stagger';
import { StatusPill } from '@/components/ui/status';
import { conflictingFields } from '@/features/works/journey';
import { PackagePreview } from '@/features/works/package-preview';
import { SessionContext } from '@/features/works/session-context';
import { CandidateValue } from '@/features/works/work-fields';

type Document = WorkView['documents'][number];
type Filter = 'all' | 'conflicts' | 'pending';

const same = (a: FieldValue | undefined, b: FieldValue) =>
  JSON.stringify(a ?? null) === JSON.stringify(b);
const filled = (value: FieldValue | undefined) =>
  Array.isArray(value) ? value.length > 0 : !!value;

export function WorkReview({
  view,
  values,
  busy,
  onChange,
  onOpen,
  onExtract,
}: {
  view: WorkView;
  values: FieldValues;
  busy: boolean;
  onChange: (changes: Partial<Record<FieldKey, FieldValue>>) => void;
  onOpen: (document: Document) => void;
  onExtract: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [focus, setFocus] = useState<{ key: FieldKey; nonce: number }>();
  const conflicts = conflictingFields(view);
  const fields = view.package.fields
    .map((field) => ({
      field,
      candidates: view.facts.candidates.filter(
        (candidate) => candidate.field === field.key,
      ),
    }))
    .filter((item) => item.candidates.length);
  const applied = (key: FieldKey) =>
    fields
      .find((item) => item.field.key === key)
      ?.candidates.some((candidate) => same(values[key], candidate.value)) ??
    false;
  const visible = fields.filter(({ field }) =>
    filter === 'conflicts'
      ? conflicts.has(field.key)
      : filter === 'pending'
        ? !applied(field.key)
        : true,
  );
  const quick = fields.filter(
    ({ field, candidates }) =>
      !conflicts.has(field.key) &&
      !filled(values[field.key]) &&
      candidates[0] !== undefined,
  );
  const total = view.package.fields.length;
  const complete = view.package.fields.filter((field) =>
    filled(values[field.key]),
  ).length;
  const jump = (key: FieldKey) => {
    setFocus({ key, nonce: Date.now() });
  };
  return (
    <div className="grid grid-cols-1 gap-8">
      <SessionContext
        session={view.session ?? null}
        revision={view.work.revision}
        fields={view.package.fields}
      />
      <section aria-labelledby="facts-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="facts-title"
              className="font-heading text-xl font-bold tracking-tight"
            >
              Найденные сведения
            </h2>
            <p className="text-muted mt-1 text-sm">
              Каждое значение — с цитатой из файла. Применённые значения
              попадают в документы.
            </p>
          </div>
          {fields.length > 0 && (
            <SegmentedControl
              label="Какие сведения показать"
              size="sm"
              value={filter}
              onValueChange={setFilter}
              items={[
                { value: 'all', label: `Все · ${String(fields.length)}` },
                {
                  value: 'conflicts',
                  label: `Расхождения · ${String(conflicts.size)}`,
                },
                {
                  value: 'pending',
                  label: `Не применены · ${String(fields.filter(({ field }) => !applied(field.key)).length)}`,
                },
              ]}
            />
          )}
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            ['Найдено полей', fields.length, ''],
            [
              'Расхождений',
              conflicts.size,
              conflicts.size ? 'text-amber-200' : '',
            ],
            [
              'Заполнено в документах',
              `${String(complete)} / ${String(total)}`,
              '',
            ],
          ].map(([label, value, tone]) => (
            <div
              key={String(label)}
              className="glass rounded-2xl border border-white/[0.07] px-4 py-3"
            >
              <p className="text-muted text-xs">{label}</p>
              <p
                className={`font-heading mt-1 text-2xl font-bold tabular-nums ${String(tone)}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
        {quick.length > 0 && (
          <div className="animate-rise mb-5 flex flex-col gap-4 rounded-2xl border border-[#ff3b62]/25 bg-[#db143c]/[0.06] p-4 backdrop-blur-[18px] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6">
              <span className="font-medium">
                {quick.length} пустых полей можно заполнить без споров
              </span>
              <span className="text-muted block text-xs">
                У них один вариант значения из файлов. Расхождения останутся для
                вашего решения.
              </span>
            </p>
            <Button
              disabled={busy}
              onClick={() => {
                onChange(
                  Object.fromEntries(
                    quick.map(({ field, candidates }) => [
                      field.key,
                      candidates[0]?.value ?? null,
                    ]),
                  ),
                );
              }}
            >
              <Wand2 size={16} />
              Применить {quick.length}
            </Button>
          </div>
        )}
        {!fields.length ? (
          <div className="glass flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-12 text-center">
            <EventHorizon state="calm" className="size-36" />
            <p className="mt-6 font-medium">Сведений пока нет</p>
            <p className="text-muted mt-2 max-w-md text-sm leading-6">
              Запустите извлечение — найденные значения с цитатами появятся
              здесь. Документы ниже можно заполнять и вручную.
            </p>
            {view.documents.length > 0 && (
              <Button
                variant="secondary"
                className="mt-6"
                loading={busy}
                onClick={onExtract}
              >
                <FileSearch size={16} />
                Извлечь сведения
              </Button>
            )}
          </div>
        ) : !visible.length ? (
          <p className="glass text-muted rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center text-sm">
            {filter === 'conflicts'
              ? 'Расхождений нет — все файлы согласны между собой.'
              : 'Все найденные значения применены.'}
          </p>
        ) : (
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
                                  onChange({ [field.key]: candidate.value });
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
                      Файлы расходятся — выберите верный вариант или впишите
                      своё значение в документе.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="paper-title">
        <h2
          id="paper-title"
          className="font-heading mb-1 text-xl font-bold tracking-tight"
        >
          Документы комплекта
        </h2>
        <p className="text-muted mb-4 text-sm">
          Поля общие для всего комплекта: исправление в одном документе появится
          во всех.
        </p>
        <PackagePreview
          pack={view.package}
          values={values}
          disabled={busy}
          focus={focus}
          onChange={(key, value) => {
            onChange({ [key]: value });
          }}
        />
      </section>
    </div>
  );
}
