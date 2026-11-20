'use client';
import { Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { type FieldKey } from '@anyko/contracts/catalog';
import { type WorkView } from '@anyko/contracts/works';
import { Button, Disclosure, SegmentedControl } from '@anyko/ui';
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
}: {
  view: WorkView;
  facts: FactsForm;
  busy: boolean;
  onOpen: (document: Document, page?: number) => void;
}) {
  const { values } = facts;
  const [filter, setFilter] = useState<ReviewFilter>('attention');
  const [panel, setPanel] = useState<'facts' | 'drafts'>('facts');
  const reviewBar = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<{ key: FieldKey; nonce: number }>();
  const { attention, visible, quick, total, complete } = reviewFields(
    view,
    values,
    filter,
  );
  // Каждый переход получает новый nonce: повторный переход к тому же полю снова его подсвечивает.
  const jump = (key: FieldKey) => {
    setFocus((previous) => ({ key, nonce: (previous?.nonce ?? 0) + 1 }));
    setPanel('drafts');
  };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div
        ref={reviewBar}
        className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-3"
      >
        <SegmentedControl
          label="Раздел проверки"
          value={panel}
          onValueChange={(next) => {
            setFocus(undefined);
            setPanel(next);
          }}
          items={[
            { value: 'facts', label: 'Сведения из файлов' },
            { value: 'drafts', label: 'Черновики документов' },
          ]}
        />
        <div className="flex w-full flex-col gap-1.5 rounded-xl border border-[#ff3b62]/25 bg-[#db143c]/[0.08] px-3.5 py-2.5 sm:w-auto sm:min-w-48">
          <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-white/85">
            Заполнено
            <span className="whitespace-nowrap text-white/75 tabular-nums">
              <strong className="text-lg leading-none font-bold text-[#ff8da4]">
                {complete}
              </strong>{' '}
              из {total}
            </span>
          </p>
          {total > 0 && (
            <div
              role="progressbar"
              aria-label="Заполнено полей комплекта"
              aria-valuenow={complete}
              aria-valuemax={total}
              aria-valuetext={`${String(complete)} из ${String(total)}`}
              className="h-1 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-[#db143c] to-[#ff8da4] motion-safe:transition-[width] motion-safe:duration-300"
                style={{ width: `${String((complete / total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <EditConflicts view={view} facts={facts} busy={busy} />
      <section
        aria-labelledby="facts-title"
        hidden={panel !== 'facts'}
        className="w-full max-w-5xl justify-self-center"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="facts-title"
              className="font-heading text-xl font-bold tracking-tight"
            >
              Найденные сведения
            </h2>
            <p className="text-muted mt-1 text-sm">
              Проверьте, что подставится в документы. Фрагменты из файлов
              помогут сверить значения.
            </p>
          </div>
          {total > 0 && (
            <SegmentedControl
              label="Какие сведения показать"
              size="sm"
              value={filter}
              onValueChange={setFilter}
              items={[
                {
                  value: 'attention',
                  label: `Требуют внимания · ${String(attention.length)}`,
                },
                { value: 'all', label: `Все поля · ${String(total)}` },
              ]}
            />
          )}
        </div>
        {quick.length > 1 && (
          <div className="animate-rise mb-5 flex flex-col gap-4 rounded-2xl border border-[#ff3b62]/25 bg-[#db143c]/[0.06] p-4 backdrop-blur-[18px] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6">
              <span className="font-medium">
                Полей с одним вариантом: {quick.length}
              </span>
              <span className="text-muted block text-xs">
                Заполнятся только пустые поля, для которых найдено одно
                значение.
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
              Заполнить поля ({quick.length})
            </Button>
          </div>
        )}
        {!view.facts.candidates.length &&
        !attention.length &&
        filter === 'attention' ? (
          <div className="glass flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-12 text-center">
            <EventHorizon state="calm" className="size-36" />
            <p className="mt-6 font-medium">Сведений пока нет</p>
            <p className="text-muted mt-2 max-w-md text-sm leading-6">
              Найденные значения с цитатами появятся здесь после извлечения.
              Поля также можно заполнить в черновиках документов.
            </p>
          </div>
        ) : !visible.length ? (
          <div className="glass rounded-2xl border border-white/10 px-6 py-8 text-center text-sm">
            <p role="status" className="font-medium">
              Поля для проверки не отмечены
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setFilter('all');
              }}
            >
              Посмотреть все поля
            </Button>
          </div>
        ) : (
          <CandidateList
            visible={visible}
            values={values}
            view={view}
            onApply={(key, value) => {
              facts.change({ [key]: value });
            }}
            busy={busy}
            jump={jump}
            onOpen={onOpen}
          />
        )}
        {view.session?.context && (
          <Disclosure
            className="mt-5 rounded-2xl border border-white/10 px-4"
            title="Сводка Anyko по файлам"
          >
            <SessionContext
              session={view.session}
              revision={view.work.revision}
              inputRevision={view.work.inputRevision}
              sourceIds={view.documents.map(({ id }) => id)}
              fields={view.package.fields}
            />
          </Disclosure>
        )}
      </section>
      {panel === 'drafts' && (
        <section aria-labelledby="paper-title">
          <h2
            id="paper-title"
            className="font-heading mb-1 text-xl font-bold tracking-tight"
          >
            Черновики документов
          </h2>
          <p className="text-muted mb-4 text-sm">
            Поля общие для всего комплекта: исправление в одном документе
            появится во всех.
          </p>
          <PackagePreview
            pack={view.package}
            values={values}
            disabled={busy}
            focus={focus}
            onBack={() => {
              setFocus(undefined);
              setPanel('facts');
              requestAnimationFrame(() => {
                reviewBar.current?.scrollIntoView({ block: 'start' });
                reviewBar.current
                  ?.querySelector<HTMLElement>('[aria-pressed=true]')
                  ?.focus({ preventScroll: true });
              });
            }}
            onChange={(key, value) => {
              facts.change({ [key]: value });
            }}
          />
        </section>
      )}
    </div>
  );
}
