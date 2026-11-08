'use client';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Tabs } from '@base-ui/react/tabs';
import { Ban, FileText, Minus, Plus, Table2 } from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  type DocumentPackage,
  type FieldKey,
  fieldKeySchema,
  type FieldRow,
  type FieldValue,
  type FieldValues,
  type PreviewParagraph,
  type PreviewRow,
} from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { FieldEditor, TextSlot } from '@/features/works/work-fields';

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

function mentions(blocks: DocumentPackage['documents'][number]['blocks']) {
  const text = blocks
    .flatMap((block) =>
      block.kind === 'paragraph'
        ? [block.paragraph.text]
        : block.rows.flatMap((row) => [
            row.repeat ? `{#${row.repeat}}` : '',
            ...row.cells.flatMap((cell) => cell.paragraphs.map((p) => p.text)),
          ]),
    )
    .join(' ');
  return text;
}

export function PackagePreview(props: Props) {
  const { pack, values, disabled, onChange, focus } = props;
  const [selected, select] = useState(pack.documents[0]?.version);
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
  useEffect(() => {
    if (!focus) return;
    const host = pack.documents.find((item) =>
      new RegExp(`\\{[#]?${focus.key}\\}`).test(mentions(item.blocks)),
    );
    if (host && host.version !== selected) {
      select(host.version);
      return;
    }
    const target =
      frame.current?.querySelector<HTMLElement>(
        `[data-field="${focus.key}"]`,
      ) ??
      window.document.querySelector<HTMLElement>(
        `[data-field-editor="${focus.key}"]`,
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
    // `selected` is a dependency so the jump finishes after a tab switch.
  }, [focus, selected, pack.documents]);
  if (!document) return null;
  const scale = zoom === 'fit' ? fit : zoom;
  const zoomIndex = zooms.findIndex((item) => item.value === scale);
  const zoomClass = zooms[zoomIndex]?.className ?? '';
  const columnsOf = (key: FieldKey) =>
    pack.fields.find((item) => item.key === key)?.columns ?? [];
  const emptyRow = (key: FieldKey): FieldRow =>
    Object.fromEntries(columnsOf(key).map((column) => [column.key, null]));
  const paperAction =
    'focus-visible:outline-brand-hot inline-flex min-h-6 items-center gap-1 rounded-md px-1.5 font-medium transition-colors hover:bg-rose-100 focus-visible:outline-2';
  const collectionNote = (key: FieldKey, collection: FieldValue) => (
    <span className="my-1 inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border border-dashed border-[#db143c]/50 bg-rose-50 px-2 py-0.5 align-middle font-sans text-[12px] leading-5 font-normal text-rose-950">
      <span className="mr-1">
        {pack.fields.find((item) => item.key === key)?.label ?? 'Список'}:{' '}
        {collection === null ? 'состав не установлен' : 'записей нет'}
      </span>
      {!disabled && (
        <>
          <ButtonPrimitive
            className={`${paperAction} text-[#b0102f]`}
            onClick={() => {
              onChange(key, [emptyRow(key)]);
            }}
          >
            <Plus size={12} />
            Добавить запись
          </ButtonPrimitive>
          {collection === null && (
            <ButtonPrimitive
              className={`${paperAction} text-zinc-600`}
              onClick={() => {
                onChange(key, []);
              }}
            >
              <Ban size={12} />
              Записей нет
            </ButtonPrimitive>
          )}
        </>
      )}
    </span>
  );
  const tokens = (
    text: string,
    row?: FieldRow,
    changeRow?: (key: string, value: string | null) => void,
  ): ReactNode[] =>
    text.split(/(\{[a-zA-Z][a-zA-Z0-9]*\})/g).map((part, index) => {
      const key = /^\{([a-zA-Z][a-zA-Z0-9]*)\}$/.exec(part)?.[1];
      if (!key) return part;
      if (key === 'rowNumber' && row) return row[key];
      const field = pack.fields.find((item) => item.key === key);
      const column = pack.fields
        .flatMap((item) => item.columns)
        .find((item) => item.key === key);
      if (row)
        return (
          <TextSlot
            key={index}
            label={`${document.title}: ${column?.label ?? key}`}
            placeholder={column?.label ?? '…'}
            value={row[key] ?? null}
            disabled={disabled}
            multiline
            onChange={(next) => changeRow?.(key, next)}
          />
        );
      if (!field || field.columns.length)
        return (
          <span key={index} className="text-zinc-400">
            [не заполнено]
          </span>
        );
      const value = values[field.key];
      return (
        <TextSlot
          key={index}
          fieldKey={field.key}
          label={field.label}
          value={typeof value === 'string' ? value : null}
          disabled={disabled}
          multiline={field.multiline}
          onChange={(next) => {
            onChange(field.key, next);
          }}
        />
      );
    });
  const paragraph = (
    p: PreviewParagraph,
    id: string,
    row?: FieldRow,
    changeRow?: (key: string, value: string | null) => void,
  ): ReactNode => {
    const loop = /\{#([a-zA-Z]+)\}/.exec(p.text)?.[1];
    const repeat = loop ? fieldKeySchema.parse(loop) : undefined;
    if (repeat && !row) {
      const collection = values[repeat];
      const rows = Array.isArray(collection) ? collection : [];
      return (
        <div key={id} data-field={repeat} className="rounded-[3px]">
          {rows.length ? (
            rows.map((item, index) =>
              paragraph(
                { ...p, text: p.text.replace(/\{[#/][a-zA-Z]+\}/g, '') },
                `${id}-${String(index)}`,
                item,
                (key, next) => {
                  onChange(
                    repeat,
                    rows.map((existing, i) =>
                      i === index ? { ...existing, [key]: next } : existing,
                    ),
                  );
                },
              ),
            )
          ) : (
            <p>{collectionNote(repeat, collection ?? null)}</p>
          )}
        </div>
      );
    }
    return (
      <div
        key={id}
        className="min-h-[1em] wrap-anywhere whitespace-pre-wrap"
        style={{
          textAlign: p.align,
          fontWeight: p.bold ? 'bold' : 'normal',
          fontSize: `${String(p.fontSize)}pt`,
          textIndent: `${String(p.indent)}pt`,
          marginBottom: `${String(Math.max(3, p.after))}pt`,
        }}
      >
        {p.text ? tokens(p.text, row, changeRow) : <br />}
      </div>
    );
  };
  const tableRow = (row: PreviewRow, index: number) => {
    const repeat = row.repeat;
    const collection = repeat ? values[repeat] : undefined;
    const entries = repeat
      ? Array.isArray(collection)
        ? collection
        : [
            Object.fromEntries(
              row.cells.flatMap((cell) =>
                cell.paragraphs.flatMap((p) =>
                  [...p.text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => [
                    m[1] ?? '',
                    null,
                  ]),
                ),
              ),
            ),
          ]
      : [undefined];
    if (repeat && Array.isArray(collection) && !collection.length)
      return (
        <tr key={index} data-field={repeat}>
          <td
            colSpan={row.cells.reduce((sum, cell) => sum + cell.span, 0)}
            className="text-center"
          >
            {collectionNote(repeat, collection)}
          </td>
        </tr>
      );
    return entries.map((entry, number) => (
      <tr
        key={`${String(index)}-${String(number)}`}
        data-field={repeat && number === 0 ? repeat : undefined}
      >
        {row.cells.map((cell, cellIndex) =>
          cell.merge === 'continue' ? null : (
            <td key={cellIndex} colSpan={cell.span} rowSpan={cell.rowSpan}>
              {cell.paragraphs.map((p, pIndex) =>
                paragraph(
                  p,
                  String(pIndex),
                  repeat
                    ? { ...entry, rowNumber: String(number + 1) }
                    : undefined,
                  (key, next) => {
                    if (!repeat) return;
                    const current =
                      Array.isArray(collection) && collection.length
                        ? collection
                        : [{}];
                    onChange(
                      repeat,
                      current.map((item, i) =>
                        i === number ? { ...item, [key]: next } : item,
                      ),
                    );
                  },
                ),
              )}
            </td>
          ),
        )}
      </tr>
    ));
  };
  return (
    <Tabs.Root
      value={document.version}
      onValueChange={(value) => {
        if (typeof value === 'string') select(value);
      }}
      render={<section className="min-w-0" aria-label="Пакет документов" />}
    >
      <div className="z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#0d0d10]/90 p-1.5 backdrop-blur-xl md:sticky md:top-3">
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
            <article
              key={document.version}
              className="animate-rise min-h-[1123px] w-[794px] max-w-none min-w-[794px] bg-white py-[76px] pr-[57px] pl-[113px] font-['Times_New_Roman',serif] text-[12pt] leading-[1.15] text-zinc-900 shadow-[0_2px_4px_#0003,0_24px_70px_-20px_#000] [&_td]:align-top"
              aria-label={document.title}
            >
              {pack.technical && (
                <p className="mb-4 text-center font-sans text-xs text-zinc-500">
                  Архивный технический бланк
                </p>
              )}
              {document.blocks.length
                ? document.blocks.map((block, index) =>
                    block.kind === 'paragraph' ? (
                      paragraph(block.paragraph, String(index))
                    ) : (
                      <table
                        key={index}
                        className={`my-3 w-full table-fixed border-collapse [&_td]:p-1 [&_td]:wrap-anywhere ${block.bordered ? '[&_td]:border [&_td]:border-zinc-600' : ''}`}
                      >
                        <colgroup>
                          {block.widths.map((width, col) => (
                            <col
                              key={col}
                              style={{
                                width: `${String(
                                  (width /
                                    Math.max(
                                      1,
                                      block.widths.reduce((a, b) => a + b, 0),
                                    )) *
                                    100,
                                )}%`,
                              }}
                            />
                          ))}
                        </colgroup>
                        <tbody>{block.rows.map(tableRow)}</tbody>
                      </table>
                    ),
                  )
                : pack.fields.map((field) => (
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
            </article>
          </div>
        </div>
        <Disclosure
          className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.015] px-5 py-2 sm:px-6"
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
