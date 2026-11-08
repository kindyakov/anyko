'use client';
import { Tabs } from '@base-ui/react/tabs';
import { type ReactNode, useState } from 'react';

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

import { Disclosure } from '@/components/ui/disclosure';
import { FieldEditor, TextSlot } from '@/features/works/work-fields';

interface Props {
  pack: DocumentPackage;
  values: FieldValues;
  disabled: boolean;
  onChange: (key: FieldKey, value: FieldValue) => void;
}
export function PackagePreview(props: Props) {
  const { pack, values, disabled, onChange } = props;
  const [selected, select] = useState(pack.documents[0]?.version);
  const document =
    pack.documents.find((item) => item.version === selected) ??
    pack.documents[0];
  if (!document) return null;
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
            placeholder="…"
            value={row[key] ?? null}
            disabled={disabled}
            multiline
            onChange={(next) => changeRow?.(key, next)}
          />
        );
      if (!field || field.columns.length)
        return <span key={index}>[не заполнено]</span>;
      const value = values[field.key];
      return (
        <TextSlot
          key={index}
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
        <div key={id}>
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
            <p>
              {collection === null
                ? 'Состав не установлен'
                : 'Записи отсутствуют'}
            </p>
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
        <tr key={index}>
          <td colSpan={row.cells.reduce((sum, cell) => sum + cell.span, 0)}>
            Указано отсутствие записей
          </td>
        </tr>
      );
    return entries.map((entry, number) => (
      <tr key={`${String(index)}-${String(number)}`}>
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
      <Tabs.List
        aria-label="Документы пакета"
        className="my-6 flex flex-wrap gap-2"
      >
        {pack.documents.map((item) => (
          <Tabs.Tab
            key={item.version}
            value={item.version}
            className="border-line text-muted aria-selected:bg-tint aria-selected:text-ink focus-visible:outline-brand min-h-11 rounded-lg border px-4 py-2 text-left text-sm focus-visible:outline-2"
          >
            {item.title}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value={document.version}>
        <p className="text-muted text-sm leading-6">
          Поля общие для всего пакета. Подсветка обозначает редактируемые места.
          Переносы страниц в DOCX могут отличаться.
        </p>
        <div className="max-w-full overflow-x-auto">
          <article
            className="border-line mx-auto my-8 min-h-[850px] w-[794px] max-w-none min-w-[794px] border bg-white py-[76px] pr-[57px] pl-[113px] font-['Times_New_Roman',serif] text-[12pt] leading-[1.15] text-zinc-900 shadow-sm [&_input]:min-h-0 [&_textarea]:min-h-[1.3em]"
            aria-label={document.title}
          >
            {pack.technical && (
              <p className="text-center font-sans text-xs text-zinc-600">
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
                      className={`my-3 w-full table-fixed border-collapse [&_td]:p-1 [&_td]:align-top [&_td]:wrap-anywhere ${block.bordered ? '[&_td]:border [&_td]:border-zinc-600' : ''}`}
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
        <Disclosure
          className="border-line bg-surface my-6 rounded-2xl border p-5 shadow-sm sm:p-7"
          title={<>Общие реквизиты и таблицы пакета</>}
        >
          <p className="text-muted text-sm leading-6">
            Здесь можно добавить строки и явно указать отсутствие объектов.
            Неизвестный состав сохраняется отдельно от отсутствия.
          </p>
          {pack.fields.map((field) => (
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
        </Disclosure>
      </Tabs.Panel>
    </Tabs.Root>
  );
}
