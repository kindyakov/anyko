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
import type { prepareTemplate } from '@anyko/document-values/template-filling';
import { missingTemplateValue } from '@anyko/document-values/template-value';

import { FieldEditor, TextSlot } from '../work-fields';

import { CollectionNote } from './collection-note';
import { paperMargins, paragraphStyle } from './paper-format';
import { PreviewTable } from './preview-table';
import { ScalarSlot } from './scalar-slot';
import { renderStatementSignature } from './statement-signature';

export function PreviewPaper({
  pack,
  document,
  values,
  prepared,
  disabled,
  onChange,
}: {
  pack: DocumentPackage;
  document: DocumentPackage['documents'][number];
  values: FieldValues;
  prepared: ReturnType<typeof prepareTemplate>;
  disabled: boolean;
  onChange: (key: FieldKey, value: FieldValue) => void;
}) {
  const listNumbers = new Map<string, number>();
  const { version, margins } = document;
  const { scalars, repeating, computedRepeats, defaults } = prepared;
  const computed = new Set(computedRepeats);
  const scalar = (key: string) =>
    Object.hasOwn(scalars, key) ? scalars[key] : undefined;
  const collectionRows = (key: string) =>
    Object.hasOwn(repeating, key) ? (repeating[key] ?? []) : [];
  const changeEntry =
    (repeat: FieldKey, index: number) => (key: string, next: string | null) => {
      const collection = values[repeat];
      const rows =
        Array.isArray(collection) && collection.length ? collection : [{}];
      onChange(
        repeat,
        rows.map((row, i) => (i === index ? { ...row, [key]: next } : row)),
      );
    };
  const collectionNote = (key: FieldKey, collection: FieldValue) => (
    <CollectionNote
      fieldKey={key}
      fields={pack.fields}
      collection={collection}
      disabled={disabled}
      onChange={onChange}
    />
  );
  const tokens = (
    p: PreviewParagraph,
    row?: FieldRow,
    changeRow?: (key: string, value: string | null) => void,
    rowField?: FieldKey,
    rowNumber?: number,
  ): ReactNode[] =>
    p.text
      .split(margins ? /(\{[^{}#/]+\}[,.;:]?)/g : /(\{[^{}#/]+\})/g)
      .map((part, index) => {
        const [, key, suffix = ''] =
          /^\{([^{}#/]+)\}([,.;:]?)$/.exec(part) ?? [];
        if (!key) return part;
        if (key === 'signerName' && !row) {
          return (
            <span key={index} aria-label="Фамилия и инициалы подписанта">
              {scalar('signerName') ?? missingTemplateValue}
              {suffix}
            </span>
          );
        }
        const column = pack.fields
          .find((item) => item.key === rowField)
          ?.columns.find((item) => item.key === key);
        if (row && rowField) {
          const source = values[rowField];
          const rowIndex = (rowNumber ?? 1) - 1;
          const display = Object.hasOwn(row, key) ? row[key] : undefined;
          if (
            computed.has(rowField) ||
            (Array.isArray(source) && !source.length && document.filling)
          )
            return (display ?? missingTemplateValue) + suffix;
          if (key === 'rowNumber' && !column)
            return (display ?? String(rowIndex + 1)) + suffix;
          const raw = Array.isArray(source)
            ? (source[rowIndex]?.[key] ?? null)
            : null;
          const hint = column?.label ?? '…';
          const slot = (
            <TextSlot
              key={index}
              label={`${document.title}: ${column?.label ?? key}`}
              maxLength={column?.maxLength}
              placeholder={
                display === missingTemplateValue || document.filling
                  ? missingTemplateValue
                  : hint
              }
              value={raw}
              displayValue={
                display === missingTemplateValue
                  ? undefined
                  : (display ?? undefined)
              }
              disabled={disabled}
              multiline
              inline={!!margins}
              suffix={suffix}
              onChange={(next) => changeRow?.(key, next)}
            />
          );
          return p.boldFields?.includes(key) ? (
            <strong key={index}>{slot}</strong>
          ) : (
            slot
          );
        }
        return (
          <ScalarSlot
            key={index}
            tag={key}
            fields={pack.fields}
            formats={document.placeholders}
            values={values}
            displayValue={scalar(key)}
            defaultText={
              Object.hasOwn(defaults, key) && values[key] == null
                ? defaults[key]
                : undefined
            }
            disabled={disabled}
            suffix={suffix}
            onChange={onChange}
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
      const rows = collectionRows(repeat);
      if (computed.has(repeat) && !rows.length) return null;
      return (
        <div key={id} data-field={repeat} className="rounded-[3px]">
          {rows.length ? (
            rows.map((item, index) =>
              paragraph(
                { ...p, text: p.text.replace(/\{[#/][^{}]+\}/g, '').trimEnd() },
                `${id}-${String(index)}`,
                item,
                changeEntry(repeat, index),
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
    const marker = p.marker;
    const number = marker ? (listNumbers.get(marker.list) ?? 0) + 1 : 0;
    if (marker) listNumbers.set(marker.list, number);
    const markerText = marker?.pattern.replace(/%\d/g, String(number));
    const numberedMultiline =
      !!marker &&
      (!!p.boldFields?.length ||
        pack.fields.some(
          ({ key, multiline }) => multiline && p.text === `{${key}}`,
        ));
    const contents =
      (document.id === 'statement' &&
        !row &&
        renderStatementSignature(
          p.text,
          scalar('signerName') ?? missingTemplateValue,
        )) ||
      (p.text ? tokens(p, row, changeRow, rowField, rowNumber) : <br />);
    return (
      <div
        key={id}
        className={`min-h-[1em] wrap-anywhere whitespace-pre-wrap ${numberedMultiline ? 'grid grid-cols-[max-content_minmax(0,1fr)] gap-x-1.5' : ''}`}
        style={paragraphStyle(p, !!margins, numberedMultiline)}
      >
        {markerText && (
          <span>
            {markerText}
            {numberedMultiline ? '' : '\u00a0\u00a0'}
          </span>
        )}
        {numberedMultiline ? (
          <div className="min-w-0">{contents}</div>
        ) : (
          contents
        )}
      </div>
    );
  };
  const tableRow = (row: PreviewRow, index: number) => {
    const repeat = row.repeat;
    const collection = repeat ? values[repeat] : undefined;
    const absent = Array.isArray(collection) && !collection.length;
    const rows = repeat ? collectionRows(repeat) : [];
    if (repeat && computed.has(repeat) && !rows.length) return null;
    if (repeat && absent && !rows.length)
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
    const entries = rows.length ? rows : [{}];
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
                  repeat ? changeEntry(repeat, number) : undefined,
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
      key={version}
      className="animate-rise min-h-[1123px] w-[794px] max-w-none min-w-[794px] bg-white py-[76px] pr-[57px] pl-[113px] font-['Times_New_Roman',serif] text-[12pt] leading-[1.15] text-zinc-900 shadow-[0_2px_4px_#0003,0_24px_70px_-20px_#000] [&_td]:align-top"
      aria-label={document.title}
      style={paperMargins(margins)}
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
              <PreviewTable
                key={index}
                block={block}
                hasMargins={!!margins}
                renderRow={tableRow}
              />
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
