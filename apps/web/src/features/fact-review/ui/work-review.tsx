'use client';
import { FileSearch, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { type FieldKey } from '@anyko/contracts/catalog';
import { type WorkView } from '@anyko/contracts/works';
import { Button, SegmentedControl } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import {
  reviewFields,
  type ReviewFilter,
} from '@/features/fact-review/model/review';

import type { FactsForm } from './facts-form';
import { PackagePreview } from './package-preview';
import { CandidateList } from './review/candidate-list';
import { EditConflicts } from './review/edit-conflicts';
import { SessionContext } from './session-context';

type Document = WorkView['documents'][number];

export function WorkReview({
  view,
  facts,
  busy,
  onOpen,
  onExtract,
}: {
  view: WorkView;
  facts: FactsForm;
  busy: boolean;
  onOpen: (document: Document, page?: number) => void;
  onExtract: () => void;
}) {
  const { values } = facts;
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [focus, setFocus] = useState<{ key: FieldKey; nonce: number }>();
  const { fields, applied, visible, quick, total, complete, conflicts } =
    reviewFields(view, values, filter);
  // Каждый переход получает новый nonce: повторный переход к тому же полю снова его подсвечивает.
  const jump = (key: FieldKey) => {
    setFocus((previous) => ({ key, nonce: (previous?.nonce ?? 0) + 1 }));
  };
  return (
    <div className="grid grid-cols-1 gap-8">
      <SessionContext
        session={view.session ?? null}
        revision={view.work.revision}
        fields={view.package.fields}
      />
      <EditConflicts view={view} facts={facts} busy={busy} />
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
                facts.change(
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
              ? 'В сохранённых сведениях нет расхождений.'
              : 'Все найденные значения применены.'}
          </p>
        ) : (
          <CandidateList
            visible={visible}
            conflicts={conflicts}
            applied={applied}
            values={values}
            view={view}
            facts={facts}
            busy={busy}
            jump={jump}
            onOpen={onOpen}
          />
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
            facts.change({ [key]: value });
          }}
        />
      </section>
    </div>
  );
}
