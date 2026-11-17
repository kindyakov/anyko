import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Ban, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
  DocumentPackage,
  FieldKey,
  FieldRow,
  FieldValue,
  FieldValues,
  PreviewParagraph,
  PreviewRow,
} from '@anyko/contracts/catalog';

import { previewEntries } from '@/features/fact-review/model/preview';

import { FieldEditor, TextSlot } from '../work-fields';

export function PreviewPaper({
  pack,
  document,
  values,
  disabled,
  onChange,
}: {
  pack: DocumentPackage;
  document: DocumentPackage['documents'][number];
  values: FieldValues;
  disabled: boolean;
  onChange: (key: FieldKey, value: FieldValue) => void;
}) {
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
    rowField?: FieldKey,
    rowNumber?: number,
  ): ReactNode[] =>
    text.split(/(\{[^{}#/]+\})/g).map((part, index) => {
      const key = /^\{([^{}#/]+)\}$/.exec(part)?.[1];
      if (!key) return part;
      const field = pack.fields.find((item) => item.key === key);
      const column = pack.fields
        .find((item) => item.key === rowField)
        ?.columns.find((item) => item.key === key);
      if (key === 'rowNumber' && row && !column) return String(rowNumber ?? 1);
      if (row)
        return (
          <TextSlot
            key={index}
            label={`${document.title}: ${column?.label ?? key}`}
            maxLength={column?.maxLength}
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
          maxLength={field.limits.maxLength}
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
    rowField?: FieldKey,
    rowNumber?: number,
  ): ReactNode => {
    const loop = /\{#([^{}]+)\}/.exec(p.text)?.[1];
    const repeat = loop || undefined;
    if (repeat && !row) {
      const collection = values[repeat];
      const rows = Array.isArray(collection) ? collection : [];
      return (
        <div key={id} data-field={repeat} className="rounded-[3px]">
          {rows.length ? (
            rows.map((item, index) =>
              paragraph(
                { ...p, text: p.text.replace(/\{[#/][^{}]+\}/g, '') },
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
                repeat,
                index + 1,
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
        {p.text ? tokens(p.text, row, changeRow, rowField, rowNumber) : <br />}
      </div>
    );
  };
  const tableRow = (row: PreviewRow, index: number) => {
    const repeat = row.repeat;
    const collection = repeat ? values[repeat] : undefined;
    const entries = previewEntries(row, collection);
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
                  repeat ? entry : undefined,
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
                  repeat ?? undefined,
                  number + 1,
                ),
              )}
            </td>
          ),
        )}
      </tr>
    ));
  };
  return (
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
  );
}
