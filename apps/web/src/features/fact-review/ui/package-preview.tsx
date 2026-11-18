'use client';
import { Tabs } from '@base-ui/react/tabs';
import { FileText, Minus, Plus, Table2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type DocumentPackage,
  type FieldKey,
  type FieldValue,
  type FieldValues,
} from '@anyko/contracts/catalog';
import { Button, Disclosure } from '@anyko/ui';

import { mentions } from '@/features/fact-review/model/preview';

import { PreviewPaper } from './preview/preview-paper';
import { FieldEditor } from './work-fields';

// Literal zoom classes so Tailwind can see them.
const zooms = [
  { value: 0.4, className: '[zoom:0.4]' },
  { value: 0.5, className: '[zoom:0.5]' },
  { value: 0.6, className: '[zoom:0.6]' },
  { value: 0.7, className: '[zoom:0.7]' },
  { value: 0.8, className: '[zoom:0.8]' },
  { value: 0.9, className: '[zoom:0.9]' },
  { value: 1, className: '[zoom:1]' },
  { value: 1.15, className: '[zoom:1.15]' },
  { value: 1.3, className: '[zoom:1.3]' },
] as const;
const PAGE_WIDTH = 794;

interface Props {
  pack: DocumentPackage;
  values: FieldValues;
  disabled: boolean;
  onChange: (key: FieldKey, value: FieldValue) => void;
  /** Bring this field into view and highlight it; a new nonce repeats the jump. */
  focus?: { key: FieldKey; nonce: number } | undefined;
}

export function PackagePreview(props: Props) {
  const { pack, values, disabled, onChange, focus } = props;
  const [selected, select] = useState(pack.documents[0]?.version);
  const [handledFocus, setHandledFocus] = useState<typeof focus>();
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fit, setFit] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const document =
    pack.documents.find((item) => item.version === selected) ??
    pack.documents[0];
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => {
      const available = node.clientWidth - 32;
      const level = [...zooms]
        .reverse()
        .find(
          (item) => item.value <= 1 && PAGE_WIDTH * item.value <= available,
        );
      setFit(level?.value ?? zooms[0].value);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  // Обрабатываем каждый запрос перехода один раз, оставляя последующий выбор вкладки пользователю.
  if (
    focus &&
    (focus.key !== handledFocus?.key || focus.nonce !== handledFocus.nonce)
  ) {
    setHandledFocus(focus);
    const host = pack.documents.find((item) =>
      new RegExp(`\\{[#]?${focus.key}\\}`).test(mentions(item.blocks)),
    );
    if (host && host.version !== selected) select(host.version);
  }
  const focusKey = focus?.key;
  const focusNonce = focus?.nonce;
  useEffect(() => {
    if (!focusKey || focusNonce === undefined) return;
    const target =
      frame.current?.querySelector<HTMLElement>(`[data-field="${focusKey}"]`) ??
      window.document.querySelector<HTMLElement>(
        `[data-field-editor="${focusKey}"]`,
      );
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Re-adding the class on the next frame restarts the highlight animation.
    target.classList.remove('animate-flash');
    requestAnimationFrame(() => {
      target.classList.add('animate-flash');
    });
    const input = target.querySelector('textarea');
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [focusKey, focusNonce]);
  if (!document) return null;
  const scale = zoom === 'fit' ? fit : zoom;
  const zoomIndex = zooms.findIndex((item) => item.value === scale);
  const zoomClass = zooms[zoomIndex]?.className ?? '';
  return (
    <Tabs.Root
      value={document.version}
      onValueChange={(value) => {
        if (typeof value === 'string') select(value);
      }}
      render={<section className="min-w-0" aria-label="Пакет документов" />}
    >
      <div className="z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#0d0d10]/70 p-1.5 backdrop-blur-xl md:sticky md:top-3">
        <Tabs.List
          aria-label="Документы пакета"
          className="relative flex min-w-0 flex-wrap gap-1"
        >
          <Tabs.Indicator className="absolute top-0 left-0 -z-1 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-xl bg-white/[0.08] shadow-[inset_0_1px_0_#ffffff14,0_0_0_1px_#ffffff10] transition-[translate,width,height] duration-300 ease-out" />
          {pack.documents.map((item) => (
            <Tabs.Tab
              key={item.version}
              value={item.version}
              className="text-muted aria-selected:text-ink focus-visible:outline-brand-hot flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[13px] transition-colors hover:text-zinc-200 focus-visible:outline-2"
            >
              <FileText size={14} className="shrink-0 opacity-70" aria-hidden />
              {item.title}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Масштаб листа"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Уменьшить масштаб"
            disabled={zoomIndex <= 0}
            onClick={() => {
              setZoom(zooms[zoomIndex - 1]?.value ?? scale);
            }}
          >
            <Minus size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-16 tabular-nums"
            aria-pressed={zoom === 'fit'}
            title="Подогнать по ширине"
            onClick={() => {
              setZoom('fit');
            }}
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Увеличить масштаб"
            disabled={zoomIndex >= zooms.length - 1}
            onClick={() => {
              setZoom(zooms[zoomIndex + 1]?.value ?? scale);
            }}
          >
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <Tabs.Panel value={document.version}>
        <div className="text-muted mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-3 w-6 rounded-[2px] border-b border-dotted border-zinc-400 bg-sky-100" />
            Заполнено — можно исправить
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-6 rounded-[2px] border-b border-dashed border-[#db143c] bg-rose-100" />
            Пусто — нажмите и впишите
          </span>
          <span>Переносы страниц в DOCX могут отличаться.</span>
        </div>
        <div
          ref={frame}
          className="max-w-full overflow-x-auto rounded-3xl bg-[radial-gradient(80%_60%_at_50%_0%,#26262c,#141417)] px-4 py-8 shadow-[inset_0_0_0_1px_#ffffff0d]"
        >
          <div className={`mx-auto w-fit ${zoomClass}`}>
            <PreviewPaper
              pack={pack}
              document={document}
              values={values}
              disabled={disabled}
              onChange={onChange}
            />
          </div>
        </div>
        <Disclosure
          className="glass mt-6 rounded-3xl border border-white/[0.08] px-5 py-2 sm:px-6"
          title={
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                <Table2 size={16} />
              </span>
              <span>
                <span className="block">Все поля и таблицы формой</span>
                <span className="text-muted block text-xs font-normal">
                  Строки кредиторов, имущества и счетов; отсутствие записей и
                  неизвестный состав
                </span>
              </span>
            </span>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[...pack.fields]
              .sort(
                (a, b) =>
                  Number(b.columns.length > 0) - Number(a.columns.length > 0),
              )
              .map((field) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? null}
                  disabled={disabled}
                  onChange={(next) => {
                    onChange(field.key, next);
                  }}
                />
              ))}
          </div>
        </Disclosure>
      </Tabs.Panel>
    </Tabs.Root>
  );
}
