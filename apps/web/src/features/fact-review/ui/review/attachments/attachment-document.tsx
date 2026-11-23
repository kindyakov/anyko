'use client';

import { FileText } from 'lucide-react';

import type { FieldRow } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  attachmentCategories,
  attachmentCategory,
  attachmentCopyKinds,
} from '@anyko/document-values/attachments';
import { fieldSurface, Select } from '@anyko/ui';

import type { AttachmentSuggestion as Suggestion } from '@/features/fact-review/model/attachment-suggestions';

type Document = WorkView['documents'][number];
export const copyKinds = [
  { value: '', label: 'Не подавать' },
  ...Object.entries(attachmentCopyKinds).map(([value, label]) => ({
    value,
    label,
  })),
];
const control = `${fieldSurface} min-h-9 w-full px-2.5 py-1.5 text-sm`;
const categories = Object.entries(attachmentCategories).map(
  ([value, label]) => ({ value, label }),
);

/** Файл работы в списке приложений: вид экземпляра, вариант названия и реквизиты. */
export function DocumentAttachment({
  document,
  options,
  row,
  disabled,
  choice,
  onChoose,
  onSave,
  onOpen,
}: {
  document: Document;
  options: [string, Suggestion][];
  row: FieldRow | undefined;
  disabled: boolean;
  choice: string | undefined;
  onChoose: (key: string) => void;
  onSave: (row: FieldRow | null) => void;
  onOpen: (page: number | undefined) => void;
}) {
  const suggestion: Suggestion | undefined =
    choice === 'filename'
      ? {
          row: { description: document.filename, category: 'other' },
        }
      : (options.find(([key]) => key === choice)?.[1] ??
        (options.length === 1 ? options[0]?.[1] : undefined));
  const variants = [
    ...options.map(([key, { row: proposed }]) => ({
      key,
      text: `${proposed.description ?? ''} · ${attachmentCategories[attachmentCategory(proposed.category) ?? 'other']}`,
      proposed,
    })),
    ...(options.length !== 1 && !row
      ? [{ key: 'filename', text: 'Имя файла · Другое', proposed: null }]
      : []),
  ];
  return (
    <li
      className={`grid min-w-0 gap-3 rounded-xl border p-3 transition-colors ${row ? 'border-brand/30 bg-brand/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            onOpen(suggestion?.page);
          }}
          className="text-ink focus-visible:outline-brand-hot flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm font-medium hover:underline focus-visible:outline-2"
        >
          <FileText size={15} aria-hidden className="text-muted shrink-0" />
          <span className="min-w-0 wrap-anywhere">{document.filename}</span>
        </button>
        <div className="sm:w-44 sm:shrink-0 [&>*]:w-full">
          <Select
            disabled={disabled || (!row && !suggestion)}
            items={copyKinds}
            label={`Вид подаваемого экземпляра для ${document.filename}`}
            value={row?.copyKind ?? ''}
            onValueChange={(copyKind) => {
              onSave(
                copyKind && (row || suggestion)
                  ? {
                      documentId: document.id,
                      description:
                        row?.description ?? suggestion?.row.description ?? '',
                      category:
                        row?.category ??
                        attachmentCategory(suggestion?.row.category) ??
                        null,
                      copyKind,
                    }
                  : null,
              );
            }}
          />
        </div>
      </div>
      {variants.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-muted text-xs">Как указать в заявлении</p>
          {variants.map(({ key, text, proposed }) => {
            const pressed =
              choice === key || (choice === undefined && options.length === 1);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  if (row && proposed)
                    onSave({
                      ...row,
                      description: proposed.description ?? null,
                      category: proposed.category ?? null,
                    });
                  onChoose(key);
                }}
                className="group focus-visible:outline-brand-hot aria-pressed:border-brand/40 aria-pressed:text-ink text-muted hover:text-ink flex w-full items-start gap-2.5 rounded-lg border border-white/[0.07] px-2.5 py-2 text-left text-[13px] leading-5 transition-colors hover:border-white/15 focus-visible:outline-2 aria-pressed:bg-white/[0.04]"
              >
                <span
                  aria-hidden
                  className="group-aria-pressed:border-brand-hot mt-1 grid size-3 shrink-0 place-items-center rounded-full border border-white/25"
                >
                  <span className="group-aria-pressed:bg-brand-hot size-1.5 rounded-full" />
                </span>
                <span className="min-w-0 wrap-anywhere">{text}</span>
              </button>
            );
          })}
        </div>
      )}
      {row && (
        <div className="grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <label className="text-muted grid min-w-0 gap-1 text-xs">
            Наименование и реквизиты
            <input
              className={control}
              aria-label={`Наименование и реквизиты для ${document.filename}`}
              maxLength={4000}
              value={row.description ?? ''}
              onChange={(event) => {
                onSave({ ...row, description: event.target.value });
              }}
            />
          </label>
          <div className="text-muted grid min-w-0 gap-1 text-xs [&>*:last-child]:w-full">
            <span>Назначение</span>
            <Select
              disabled={disabled}
              items={categories}
              label={`Назначение для ${document.filename}`}
              value={row.category ?? 'other'}
              onValueChange={(category) => {
                onSave({ ...row, category });
              }}
            />
          </div>
        </div>
      )}
    </li>
  );
}
