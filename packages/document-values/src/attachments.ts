export const submittedAttachmentsField = 'submittedAttachments';
export const attachmentCopyKinds = {
  paperOriginal: 'Бумажный оригинал',
  electronicOriginal: 'Электронный оригинал',
  copy: 'Копия',
} as const;
export const attachmentCategories = {
  other: 'Другой подтверждающий документ',
  egrn: 'Выписка из ЕГРН',
  procedureExpenses: 'Расходы по процедуре',
  trusteeRemuneration: 'Вознаграждение финансовому управляющему',
} as const;

export function hasSubmittedAttachments(fields: readonly { key: string }[]) {
  return fields.some(({ key }) => key === submittedAttachmentsField);
}

export function attachmentCopyKind(value: string | null | undefined) {
  return value && Object.hasOwn(attachmentCopyKinds, value)
    ? (value as keyof typeof attachmentCopyKinds)
    : undefined;
}

export function attachmentCategory(value: string | null | undefined) {
  return value && Object.hasOwn(attachmentCategories, value)
    ? (value as keyof typeof attachmentCategories)
    : undefined;
}

type AttachmentRow = Record<string, string | null>;

export function submittedAttachmentRows(
  value: string | AttachmentRow[] | null | undefined,
  documentIds?: ReadonlySet<string>,
) {
  return Array.isArray(value)
    ? value.filter(
        ({ documentId }) =>
          documentId && (!documentIds || documentIds.has(documentId)),
      )
    : [];
}

export function attachmentDescriptions(
  value: string | AttachmentRow[] | null | undefined,
) {
  return submittedAttachmentRows(value).flatMap((row) => {
    const description = row.description?.trim();
    const kind = attachmentCopyKind(row.copyKind);
    const category = attachmentCategory(row.category);
    if (!description || !kind || !category) return [];
    const payment =
      category === 'procedureExpenses' || category === 'trusteeRemuneration'
        ? ` — ${attachmentCategories[category].toLocaleLowerCase('ru')}`
        : '';
    return [
      {
        description: `${description}${payment} (${attachmentCopyKinds[kind].toLocaleLowerCase('ru')})`,
      },
    ];
  });
}
