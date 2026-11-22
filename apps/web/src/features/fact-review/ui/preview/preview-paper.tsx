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
import { bankruptcyCollectionCell } from '@anyko/document-values/bankruptcy-projection';

import {
  previewDocumentValues,
  previewEntries,
} from '@/features/fact-review/model/preview';

import { FieldEditor, TextSlot } from '../work-fields';

import { CollectionNote } from './collection-note';
import { paperMargins, paragraphStyle, signerName } from './paper-format';
import { PreviewTable } from './preview-table';
import { ScalarSlot } from './scalar-slot';
import { renderStatementSignature } from './statement-signature';

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
  const listNumbers = new Map<string, number>();
  const { version, margins } = document;
  const projected = previewDocumentValues(version, values, pack.fields);
  const collectionValue = projected?.value ?? ((key: FieldKey) => values[key]);
  const collectionNote = (key: FieldKey, collection: FieldValue) =>
    projected?.isCollection(key) ? (
      projected.emptyNote(key, collection)
    ) : (
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
              {signerName(values, projected?.modern)}
              {suffix}
            </span>
          );
        }
        const column = pack.fields
          .find((item) => item.key === rowField)
          ?.columns.find((item) => item.key === key);
        const source = rowField ? collectionValue(rowField) : undefined;
        const absent =
          projected?.modern && Array.isArray(source) && !source.length;
        if (key === 'rowNumber' && row && !column)
          return (
            (row.rowNumber ?? (absent ? '-' : String(rowNumber ?? 1))) + suffix
          );
        if (row && projected?.isCollection(rowField))
          return (row[key] ?? '[не заполнено]') + suffix;
        const text = !row && projected?.text(key);
        if (typeof text === 'string') return text + suffix;
        if (row && absent) return '-' + suffix;
        if (row) {
          const slot = (
            <TextSlot
              key={index}
              label={`${document.title}: ${column?.label ?? key}`}
              maxLength={column?.maxLength}
              placeholder={
                projected?.modern ? '[не заполнено]' : (column?.label ?? '…')
              }
              value={row[key] ?? null}
              displayValue={
                projected?.modern && row[key]
                  ? bankruptcyCollectionCell(key, row[key], source, true)
                  : undefined
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
            modern={projected?.modern ?? false}
            defaultText={projected?.defaultText(key)}
            translatedText={projected?.translatedText}
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
      const collection = collectionValue(repeat);
      const rows = Array.isArray(collection) ? collection : [];
      return (
        <div key={id} data-field={repeat} className="rounded-[3px]">
          {rows.length ? (
            rows.map((item, index) =>
              paragraph(
                { ...p, text: p.text.replace(/\{[#/][^{}]+\}/g, '').trimEnd() },
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
        renderStatementSignature(p.text, values, projected?.modern)) ||
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
    const collection = repeat ? collectionValue(repeat) : undefined;
    const absent = Array.isArray(collection) && !collection.length;
    if (repeat && absent && projected?.isCollection(repeat)) return null;
    if (repeat && absent && !projected?.modern)
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
    const entries = previewEntries(
      row,
      projected?.modern && absent ? null : collection,
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
