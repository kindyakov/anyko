'use client';

import type { FieldRow, FieldValue } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  attachmentCategories,
  attachmentCategory,
  attachmentCopyKinds,
  submittedAttachmentRows,
} from '@anyko/document-values/attachments';
import { Button, fieldSurface } from '@anyko/ui';

type Document = WorkView['documents'][number];
const control = `${fieldSurface} min-h-9 w-full px-2.5 py-1.5 text-sm`;

export function AttachmentReview({
  view,
  value,
  disabled,
  onChange,
  onOpen,
}: {
  view: WorkView;
  value: FieldValue | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
  onOpen: (document: Document, page?: number) => void;
}) {
  const selected = submittedAttachmentRows(
    value,
    new Set(view.documents.map(({ id }) => id)),
  );
  const suggestions = new Map<string, { row: FieldRow; page?: number }>();
  for (const candidate of view.facts.candidates) {
    if (
      candidate.field !== 'attachments' ||
      candidate.origin === 'inference' ||
      !Array.isArray(candidate.value)
    )
      continue;
    const source = candidate.evidence[0];
    const row = candidate.value[0];
    if (
      source &&
      row?.description?.trim() &&
      candidate.evidence.every(
        ({ documentId }) => documentId === source.documentId,
      ) &&
      !suggestions.has(source.documentId)
    ) {
      suggestions.set(source.documentId, {
        row,
        ...(source.page !== undefined && { page: source.page }),
      });
    }
  }
  const save = (documentId: string, row: FieldRow | null) => {
    const existing = selected.some((item) => item.documentId === documentId);
    if (existing)
      onChange(
        selected.flatMap((item) =>
          item.documentId === documentId ? (row ?? []) : item,
        ),
      );
    else if (row) onChange([...selected, row]);
  };
  return (
    <fieldset
      disabled={disabled}
      className="glass mb-5 min-w-0 rounded-2xl border border-white/10 p-4"
    >
      <legend className="font-heading px-1 text-base font-bold">
        Подаваемые приложения
      </legend>
      {view.documents.length === 0 ? (
        <p className="text-muted text-sm">
          Добавьте файл к работе, чтобы выбрать его для подачи.
        </p>
      ) : (
        <>
          <p className="text-muted mb-3 text-sm">
            Укажите вид экземпляра для каждого файла, который подаёте.
          </p>
          <ul className="grid gap-3">
            {view.documents.map((document) => {
              const suggestion = suggestions.get(document.id);
              const row = selected.find(
                ({ documentId }) => documentId === document.id,
              );
              return (
                <li
                  key={document.id}
                  className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2"
                >
                  <div className="min-w-0 self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto max-w-full text-left break-all whitespace-normal"
                      onClick={() => {
                        onOpen(document, suggestion?.page);
                      }}
                    >
                      {document.filename}
                    </Button>
                    {suggestion?.row.description && (
                      <p className="text-muted px-2 text-xs wrap-anywhere">
                        {suggestion.row.description}
                      </p>
                    )}
                  </div>
                  <label className="grid min-w-0 gap-1 text-xs">
                    Вид подаваемого экземпляра
                    <select
                      className={control}
                      aria-label={`Вид подаваемого экземпляра для ${document.filename}`}
                      value={row?.copyKind ?? ''}
                      onChange={(event) => {
                        const copyKind = event.target.value;
                        save(
                          document.id,
                          copyKind
                            ? {
                                documentId: document.id,
                                description:
                                  row?.description ??
                                  suggestion?.row.description ??
                                  document.filename,
                                category:
                                  row?.category ??
                                  attachmentCategory(
                                    suggestion?.row.category,
                                  ) ??
                                  'other',
                                copyKind,
                              }
                            : null,
                        );
                      }}
                    >
                      <option value="">Не подавать</option>
                      {Object.entries(attachmentCopyKinds).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
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
                      <label className="grid min-w-0 gap-1 text-xs">
                        Назначение
                        <select
                          className={control}
                          aria-label={`Назначение для ${document.filename}`}
                          value={row.category ?? 'other'}
                          onChange={(event) => {
                            save(document.id, {
                              ...row,
                              category: event.target.value,
                            });
                          }}
                        >
                          {Object.entries(attachmentCategories).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
