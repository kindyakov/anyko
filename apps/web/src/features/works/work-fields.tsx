'use client';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { Input } from '@base-ui/react/input';
import { useLayoutEffect, useRef } from 'react';

import type { FieldDefinition, FieldRow, FieldValue } from '@anyko/contracts';

import { Button } from '@/components/ui/button';

export function TextSlot({
  label,
  placeholder,
  value,
  disabled,
  multiline,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  disabled: boolean;
  multiline: boolean;
  onChange: (value: string | null) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${String(Math.max(node.scrollHeight, 24))}px`;
  }, [value, multiline]);
  const props = {
    'aria-label': label,
    title: label,
    disabled,
    value: value ?? '',
    placeholder: placeholder ?? label,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      onChange(event.target.value || null);
    },
  };
  return multiline ? (
    <Field.Control
      render={<textarea ref={textarea} rows={1} />}
      {...props}
      className="focus-visible:outline-brand inline-block w-full max-w-full min-w-[3em] resize-y rounded-none border-0 border-b border-dashed border-amber-700 bg-amber-50 px-1 py-px align-baseline align-top text-zinc-900 [font:inherit] focus-visible:outline-2"
    />
  ) : (
    <Input
      {...props}
      className="focus-visible:outline-brand inline-block max-w-full min-w-[3em] rounded-none border-0 border-b border-dashed border-amber-700 bg-amber-50 px-1 py-px align-baseline text-zinc-900 [font:inherit] focus-visible:outline-2"
      style={{
        width: `${String(Math.min(60, Math.max(4, (value || placeholder || label).length + 1)))}ch`,
      }}
    />
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
      <Field.Root className="my-6 grid gap-2 text-sm font-medium">
        <Field.Label>{field.label}</Field.Label>
        <TextSlot
          label={field.label}
          value={typeof value === 'string' ? value : null}
          disabled={disabled}
          multiline={field.multiline}
          onChange={onChange}
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
      className="border-line [&_td]:border-line [&_th]:border-line my-6 min-w-0 rounded-xl border p-4 [&_table]:w-full [&_table]:min-w-[650px] [&_td]:min-w-[100px] [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left"
      disabled={disabled}
    >
      <Fieldset.Legend>{field.label}</Fieldset.Legend>
      <p className="text-muted text-sm leading-6">
        {value === null
          ? 'Состав не установлен'
          : rows.length
            ? `Записей: ${String(rows.length)}`
            : 'Указано отсутствие записей'}
      </p>
      <div className="max-w-full overflow-x-auto">
        <table>
          <thead>
            <tr>
              {field.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {field.columns.map((column) => (
                  <td key={column.key}>
                    <TextSlot
                      label={`${field.label}, строка ${String(index + 1)}, ${column.label}`}
                      value={row[column.key] ?? null}
                      disabled={disabled}
                      multiline
                      onChange={(next) => {
                        setCell(index, column.key, next);
                      }}
                    />
                  </td>
                ))}
                <td>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onChange(rows.filter((_, i) => i !== index));
                    }}
                  >
                    Удалить строку
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={rows.length >= 100}
          onClick={() => {
            onChange([...rows, emptyRow]);
          }}
        >
          Добавить строку
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onChange([]);
          }}
        >
          Указать отсутствие
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onChange(null);
          }}
        >
          Состав неизвестен
        </Button>
      </div>
    </Fieldset.Root>
  );
}
export function CandidateValue({ value }: { value: FieldValue }) {
  if (!Array.isArray(value)) return <p>{value}</p>;
  if (!value.length) return <p>Объекты отсутствуют по данным источника</p>;
  return (
    <ul>
      {value.map((row, index) => (
        <li key={index}>{Object.values(row).filter(Boolean).join(' · ')}</li>
      ))}
    </ul>
  );
}
