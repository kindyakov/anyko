'use client';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { Ban, CircleHelp, Plus, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import type { FieldDefinition, FieldRow, FieldValue } from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { fieldSurface } from '@/components/ui/input';

const paper =
  'rounded-[2px] border-0 border-b px-0.5 py-px text-zinc-900 transition-[background-color,box-shadow] duration-200 outline-none focus-visible:bg-white focus-visible:shadow-[0_0_0_2px_#db143c] border-dotted border-zinc-400 bg-sky-50/70 hover:bg-sky-100/80 data-[empty]:border-dashed data-[empty]:border-[#db143c]/70 data-[empty]:bg-rose-50 data-[empty]:hover:bg-rose-100/80 placeholder:text-rose-700/55 placeholder:italic disabled:opacity-70';
const panel = `${fieldSurface} min-h-9 px-2.5 py-1.5 text-[13px] leading-5`;

/**
 * Editable gap inside a document. `field-sizing: content` makes the slot as
 * wide as its value or label and lets long values wrap instead of clipping.
 * Browsers without it get the measured height and a character-based width.
 */
export function TextSlot({
  label,
  placeholder,
  value,
  disabled,
  multiline,
  onChange,
  fieldKey,
  tone = 'paper',
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  disabled: boolean;
  multiline: boolean;
  onChange: (value: string | null) => void;
  fieldKey?: string;
  tone?: 'paper' | 'panel';
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node || CSS.supports('field-sizing', 'content')) return;
    node.style.height = 'auto';
    node.style.height = `${String(Math.max(node.scrollHeight, 22))}px`;
  }, [value, multiline]);
  const block = multiline || tone === 'panel';
  const text = value || placeholder || label;
  return (
    <span
      data-field={fieldKey}
      className={`max-w-full rounded-[3px] ${block ? 'block w-full' : 'inline-block align-bottom'}`}
    >
      <Field.Control
        render={
          <textarea
            ref={textarea}
            rows={1}
            cols={Math.min(60, Math.max(3, text.length + 1))}
          />
        }
        aria-label={label}
        title={label}
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder ?? label}
        data-empty={!value || undefined}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (!multiline && event.key === 'Enter') event.preventDefault();
        }}
        onChange={(
          event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          const next = multiline
            ? event.target.value
            : event.target.value.replace(/\s*\n\s*/g, ' ');
          onChange(next || null);
        }}
        className={`block [field-sizing:content] max-w-full min-w-[3ch] resize-none overflow-hidden wrap-anywhere [font:inherit] ${block ? 'w-full' : ''} ${tone === 'paper' ? paper : panel}`}
      />
    </span>
  );
}

export function FieldEditor({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDefinition;
  value: FieldValue;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  if (!field.columns.length)
    return (
      <Field.Root className="grid gap-1.5" data-field-editor={field.key}>
        <Field.Label className="text-muted text-xs">{field.label}</Field.Label>
        <TextSlot
          label={field.label}
          value={typeof value === 'string' ? value : null}
          disabled={disabled}
          multiline={field.multiline}
          onChange={onChange}
          tone="panel"
        />
      </Field.Root>
    );
  const rows = Array.isArray(value) ? value : [];
  const setCell = (index: number, column: string, next: string | null) => {
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [column]: next } : row)),
    );
  };
  const emptyRow: FieldRow = Object.fromEntries(
    field.columns.map(({ key }) => [key, null]),
  );
  return (
    <Fieldset.Root
      className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-4 sm:col-span-full"
      disabled={disabled}
      data-field-editor={field.key}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Fieldset.Legend className="font-heading text-sm font-bold">
          {field.label}
        </Fieldset.Legend>
        <span className="text-muted text-xs">
          {value === null
            ? 'Состав не установлен'
            : rows.length
              ? `Записей: ${String(rows.length)}`
              : 'Указано, что записей нет'}
        </span>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="w-8 pb-2 font-medium">№</th>
                {field.columns.map((column) => (
                  <th key={column.key} className="pr-2 pb-2 font-medium">
                    {column.label}
                  </th>
                ))}
                <th className="w-10 pb-2">
                  <span className="sr-only">Действие</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="align-top">
                  <td className="text-muted py-1 pr-2 tabular-nums">
                    {index + 1}
                  </td>
                  {field.columns.map((column) => (
                    <td key={column.key} className="min-w-[110px] py-1 pr-2">
                      <TextSlot
                        label={`${field.label}, строка ${String(index + 1)}, ${column.label}`}
                        placeholder={column.label}
                        value={row[column.key] ?? null}
                        disabled={disabled}
                        multiline
                        tone="panel"
                        onChange={(next) => {
                          setCell(index, column.key, next);
                        }}
                      />
                    </td>
                  ))}
                  <td className="py-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Удалить строку ${String(index + 1)}`}
                      title="Удалить строку"
                      onClick={() => {
                        onChange(rows.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={rows.length >= 100}
          onClick={() => {
            onChange([...rows, emptyRow]);
          }}
        >
          <Plus size={14} />
          Добавить строку
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={value !== null && !rows.length}
          onClick={() => {
            onChange([]);
          }}
        >
          <Ban size={14} />
          Записей нет
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={value === null}
          onClick={() => {
            onChange(null);
          }}
        >
          <CircleHelp size={14} />
          Состав неизвестен
        </Button>
      </div>
    </Fieldset.Root>
  );
}

export function CandidateValue({ value }: { value: FieldValue }) {
  if (!Array.isArray(value))
    return <p className="font-medium wrap-anywhere">{value}</p>;
  if (!value.length)
    return (
      <p className="font-medium">Объекты отсутствуют по данным источника</p>
    );
  return (
    <ul className="grid gap-1">
      {value.map((row, index) => (
        <li key={index} className="wrap-anywhere">
          <span className="text-muted mr-1.5 tabular-nums">{index + 1}.</span>
          {Object.values(row).filter(Boolean).join(' · ')}
        </li>
      ))}
    </ul>
  );
}
