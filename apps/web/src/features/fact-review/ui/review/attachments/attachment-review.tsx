'use client';

import { Paperclip } from 'lucide-react';
import { useState } from 'react';

import type { FieldRow, FieldValue } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  packageAttachments,
  submittedAttachmentRows,
} from '@anyko/document-values/attachments';
import { Button, Modal, Select } from '@anyko/ui';

import { attachmentSuggestions } from '@/features/fact-review/model/attachment-suggestions';

import { copyKinds, DocumentAttachment } from './attachment-document';

type Document = WorkView['documents'][number];
const generatedCopyKinds = [
  { value: '', label: 'Не подавать' },
  { value: 'paperOriginal', label: 'Оригинал' },
];
const sectionTitle =
  'text-muted mb-2 text-xs font-semibold tracking-wide uppercase';

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
  // Выбор варианта живёт вне окна: после просмотра файла окно открывается с тем же выбором.
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
        <fieldset disabled={disabled} className="grid min-w-0 gap-6">
          <legend className="sr-only">Вид и реквизиты приложений</legend>
          <section>
            <h3 className={sectionTitle}>Пункты комплекта</h3>
            <ul className="grid gap-2">
              {packageAttachments.map(
                ({ documentId, description, category, originalOnly }) => (
                  <li
                    key={documentId}
                    className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:flex-row sm:items-center"
                  >
                    <span className="min-w-0 flex-1 text-sm leading-5">
                      {description}
                    </span>
                    <div className="sm:w-44 sm:shrink-0 [&>*]:w-full">
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
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
          <section>
            <h3 className={sectionTitle}>Файлы работы</h3>
            {documents.length === 0 ? (
              <p className="text-muted text-sm">
                Добавьте файл к работе, чтобы выбрать его для подачи.
              </p>
            ) : (
              <ul className="grid gap-2">
                {documents.map((document) => (
                  <DocumentAttachment
                    key={document.id}
                    document={document}
                    options={[
                      ...(suggestions.get(document.id)?.entries() ?? []),
                    ]}
                    row={selected.find(
                      ({ documentId }) => documentId === document.id,
                    )}
                    disabled={disabled}
                    choice={chosen[document.id]}
                    onChoose={(key) => {
                      setChosen((current) => ({
                        ...current,
                        [document.id]: key,
                      }));
                    }}
                    onSave={(row) => {
                      save(document.id, row);
                    }}
                    onOpen={(page) => {
                      setOpen(false);
                      onOpen(document, page);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </fieldset>
      </Modal>
    </>
  );
}
