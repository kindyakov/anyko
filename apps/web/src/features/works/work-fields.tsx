'use client';
import { useLayoutEffect, useRef } from 'react';
import type { FieldDefinition, FieldValue, FieldRow } from '@anyko/contracts';

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
    <textarea
      {...props}
      ref={textarea}
      rows={1}
      className="template-slot template-slot-multiline"
    />
  ) : (
    <input
      {...props}
      className="template-slot"
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
      <label className="paper-field">
        {field.label}
        <TextSlot
          label={field.label}
          value={typeof value === 'string' ? value : null}
          disabled={disabled}
          multiline={field.multiline}
          onChange={onChange}
        />
      </label>
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
    <fieldset className="collection-editor" disabled={disabled}>
      <legend>{field.label}</legend>
      <p className="muted">
        {value === null
          ? 'Состав не установлен'
          : rows.length
            ? `Записей: ${String(rows.length)}`
            : 'Указано отсутствие записей'}
      </p>
      <div className="template-table-scroll">
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
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      onChange(rows.filter((_, i) => i !== index));
                    }}
                  >
                    Удалить строку
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="work-actions">
        <button
          type="button"
          disabled={rows.length >= 100}
          onClick={() => {
            onChange([...rows, emptyRow]);
          }}
        >
          Добавить строку
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            onChange([]);
          }}
        >
          Указать отсутствие
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            onChange(null);
          }}
        >
          Состав неизвестен
        </button>
      </div>
    </fieldset>
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
