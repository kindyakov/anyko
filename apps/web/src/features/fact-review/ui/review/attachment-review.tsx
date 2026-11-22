'use client';

import { Paperclip } from 'lucide-react';
import { useState } from 'react';

import type { FieldRow, FieldValue } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  attachmentCategories,
  attachmentCategory,
  attachmentCopyKinds,
  packageAttachments,
  submittedAttachmentRows,
} from '@anyko/document-values/attachments';
import { Button, fieldSurface, Modal, Select } from '@anyko/ui';

import { attachmentSuggestions } from '@/features/fact-review/model/attachment-suggestions';

type Document = WorkView['documents'][number];
const control = `${fieldSurface} min-h-9 w-full px-2.5 py-1.5 text-sm`;
const copyKinds = [
  { value: '', label: 'Не подавать' },
  ...Object.entries(attachmentCopyKinds).map(([value, label]) => ({
    value,
    label,
  })),
];
const categories = Object.entries(attachmentCategories).map(
  ([value, label]) => ({ value, label }),
);
const generatedCopyKinds = [
  { value: '', label: 'Не подавать' },
  { value: 'paperOriginal', label: 'Оригинал' },
];

export function AttachmentReview({
  documents,
  candidates,
  value,
  disabled,
  onChange,
  onOpen,
}: {
  documents: WorkView['documents'];
  candidates: WorkView['facts']['candidates'];
  value: FieldValue | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
  onOpen: (document: Document, page?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const selected = submittedAttachmentRows(
    value,
    new Set(documents.map(({ id }) => id)),
  );
  const suggestions = attachmentSuggestions(candidates);
  const save = (documentId: string, row: FieldRow | null) => {
    const existing = selected.some((item) => item.documentId === documentId);
    if (existing)
      onChange(
        selected.flatMap((item) =>
          item.documentId === documentId ? (row ? [row] : []) : [item],
        ),
      );
    else if (row) onChange([...selected, row]);
  };
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Paperclip size={16} aria-hidden />
        Приложения
        {selected.length > 0 && (
          <span
            className="text-muted text-xs tabular-nums"
            aria-label={`Выбрано позиций: ${String(selected.length)}`}
          >
            {selected.length}
          </span>
        )}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Подаваемые приложения"
        description="В заявление попадут позиции, для которых выбран вид экземпляра."
        size="sheet"
      >
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="sr-only">Вид и реквизиты приложений</legend>
          <h3 className="mb-1 text-sm font-semibold">Пункты комплекта</h3>
          <ul className="divide-y divide-white/10">
            {packageAttachments.map(
              ({ documentId, description, category, originalOnly }) => (
                <li
                  key={documentId}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)] items-center gap-2 py-2"
                >
                  <span className="px-1 text-sm">{description}</span>
                  <Select
                    disabled={disabled}
                    items={originalOnly ? generatedCopyKinds : copyKinds}
                    label={`Вид подаваемого экземпляра для ${description}`}
                    value={
                      selected.find((row) => row.documentId === documentId)
                        ?.copyKind ?? ''
                    }
                    onValueChange={(copyKind) => {
                      save(
                        documentId,
                        copyKind
                          ? { documentId, description, category, copyKind }
                          : null,
                      );
                    }}
                  />
                </li>
              ),
            )}
          </ul>
          <h3 className="mt-4 mb-1 text-sm font-semibold">Файлы работы</h3>
          {documents.length === 0 ? (
            <p className="text-muted text-sm">
              Добавьте файл к работе, чтобы выбрать его для подачи.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {documents.map((document) => {
                const options = [
                  ...(suggestions.get(document.id)?.entries() ?? []),
                ];
                const choice = chosen[document.id];
                const suggestion =
                  choice === 'filename'
                    ? {
                        row: {
                          description: document.filename,
                          category: 'other',
                        },
                        page: undefined,
                      }
                    : (options.find(([key]) => key === choice)?.[1] ??
                      (options.length === 1 ? options[0]?.[1] : undefined));
                const row = selected.find(
                  ({ documentId }) => documentId === document.id,
                );
                return (
                  <li
                    key={document.id}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)] items-center gap-x-2 gap-y-2 py-2"
                  >
                    <div className="min-w-0 self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto max-w-full min-w-0 px-1 text-left wrap-anywhere whitespace-normal"
                        onClick={() => {
                          setOpen(false);
                          onOpen(document, suggestion?.page);
                        }}
                      >
                        {document.filename}
                      </Button>
                      {options.map(([key, { row: proposed }]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant="ghost"
                          aria-pressed={choice === key}
                          className="h-auto px-1 text-left wrap-anywhere whitespace-normal"
                          onClick={() => {
                            if (row)
                              save(document.id, {
                                ...row,
                                description: proposed.description ?? null,
                                category: proposed.category ?? null,
                              });
                            setChosen((current) => ({
                              ...current,
                              [document.id]: key,
                            }));
                          }}
                        >
                          {proposed.description} ·{' '}
                          {
                            attachmentCategories[
                              attachmentCategory(proposed.category) ?? 'other'
                            ]
                          }
                        </Button>
                      ))}
                      {options.length !== 1 && !row && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-pressed={choice === 'filename'}
                          onClick={() => {
                            setChosen((current) => ({
                              ...current,
                              [document.id]: 'filename',
                            }));
                          }}
                        >
                          Имя файла · Другое
                        </Button>
                      )}
                    </div>
                    <div className="grid min-w-0 gap-1 text-xs">
                      <Select
                        disabled={disabled || (!row && !suggestion)}
                        items={copyKinds}
                        label={`Вид подаваемого экземпляра для ${document.filename}`}
                        value={row?.copyKind ?? ''}
                        onValueChange={(copyKind) => {
                          save(
                            document.id,
                            copyKind && (row || suggestion)
                              ? {
                                  documentId: document.id,
                                  description:
                                    row?.description ??
                                    suggestion?.row.description ??
                                    '',
                                  category:
                                    row?.category ??
                                    attachmentCategory(
                                      suggestion?.row.category,
                                    ) ??
                                    null,
                                  copyKind,
                                }
                              : null,
                          );
                        }}
                      />
                    </div>
                    {row && (
                      <>
                        <label className="grid min-w-0 gap-1 text-xs">
                          Наименование и реквизиты
                          <input
                            className={control}
                            aria-label={`Наименование и реквизиты для ${document.filename}`}
                            maxLength={4000}
                            value={row.description ?? ''}
                            onChange={(event) => {
                              save(document.id, {
                                ...row,
                                description: event.target.value,
                              });
                            }}
                          />
                        </label>
                        <div className="grid min-w-0 gap-1 text-xs">
                          <span>Назначение</span>
                          <Select
                            disabled={disabled}
                            items={categories}
                            label={`Назначение для ${document.filename}`}
                            value={row.category ?? 'other'}
                            onValueChange={(category) => {
                              save(document.id, {
                                ...row,
                                category,
                              });
                            }}
                          />
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      </Modal>
    </>
  );
}
