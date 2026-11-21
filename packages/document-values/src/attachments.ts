import { canonicalCalendarDate } from './calendar-date';

export const submittedAttachmentsField = 'submittedAttachments';
export const attachmentCopyKinds = {
  paperOriginal: 'Бумажный оригинал',
  electronicOriginal: 'Электронный оригинал',
  copy: 'Копия',
} as const;
export const attachmentCategories = {
  other: 'Другой подтверждающий документ',
  debtCertificate: 'Документ о задолженности',
  pensionAccount: 'Сведения о состоянии индивидуального лицевого счёта',
  egrn: 'Выписка из ЕГРН',
  procedureExpenses: 'Расходы по процедуре',
  trusteeRemuneration: 'Вознаграждение финансовому управляющему',
} as const;

export const packageAttachments = [
  {
    documentId: 'package:creditors',
    description:
      'Список кредиторов и должников гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
    category: 'other',
    originalOnly: true,
  },
  {
    documentId: 'package:inventory',
    description:
      'Опись имущества гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
    category: 'other',
    originalOnly: true,
  },
  {
    documentId: 'package:procedure-expenses',
    description:
      'Чек о внесении денежных средств на депозитный счёт суда на расходы в процедуре банкротства',
    category: 'procedureExpenses',
    originalOnly: false,
  },
  {
    documentId: 'package:postal-receipts',
    description:
      'Почтовые квитанции об отправлении заявления кредиторам и в уполномоченный орган',
    category: 'other',
    originalOnly: false,
  },
] as const;

export function packageAttachment(documentId: string | null | undefined) {
  return packageAttachments.find((item) => item.documentId === documentId);
}

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
          documentId &&
          (!documentIds ||
            documentIds.has(documentId) ||
            packageAttachment(documentId)),
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
      !packageAttachment(row.documentId) &&
      (category === 'procedureExpenses' || category === 'trusteeRemuneration')
        ? ` — ${attachmentCategories[category].toLocaleLowerCase('ru')}`
        : '';
    const mark = kind === 'copy' ? 'копия' : 'оригинал';
    return [
      {
        description: `${description}${payment} (${mark})`,
      },
    ];
  });
}

export function debtAttachmentDescription(row: AttachmentRow) {
  const number = row.contractNumber?.trim().replace(/^№\s*/u, '');
  const creditor = (row.creditorShortName || row.name)?.trim();
  const citedDate = row.proof?.match(
    /(?:выдан[ао]?|дата выдачи)\s*[:–—-]?\s*(?:от\s+)?(\d{2}\.\d{2}\.\d{4})/iu,
  )?.[1];
  const genericDate = row.proof?.match(
    /^(?:(?!договор).)*?\sот\s+(\d{2}\.\d{2}\.\d{4})/iu,
  )?.[1];
  const fallbackDate = canonicalCalendarDate(genericDate ?? '');
  const date =
    canonicalCalendarDate(citedDate ?? '') ??
    (fallbackDate === canonicalCalendarDate(row.contractDate ?? '')
      ? undefined
      : fallbackDate);
  if (!number || !creditor) return row.proof?.trim();
  if (row.proof && !/справк/iu.test(row.proof)) return row.proof.trim();
  const type = row.type?.toLowerCase() ?? '';
  const basis = /за[её]м|займ/u.test(type)
    ? 'по договору займа'
    : /кредитн[а-яё]* карт/u.test(type)
      ? 'по договору кредитной карты'
      : /кредит/u.test(type)
        ? 'по кредитному договору'
        : 'по договору';
  // Decline the leading bank noun; quoted names and legal form abbreviations are preserved.
  const instrumental = /^банк\s/iu.test(creditor)
    ? 'с ' + creditor.replace(/^банк/iu, 'Банком')
    : /^сбербанк(?=\s|$)/iu.test(creditor)
      ? 'со ' + creditor.replace(/^сбербанк/iu, 'Сбербанком')
      : /^(?:ПАО|АО|ООО|МКК|МФК)\s/iu.test(creditor)
        ? 'с ' + creditor
        : `с кредитором «${creditor}»`;
  const title = row.proof
    ? 'Справка о размере задолженности'
    : 'Документ, подтверждающий задолженность';
  const certificateNumber = row.proof?.match(
    /(?:^\s*справка(?:(?!договор|по\s+(?:кредит|займ|за[её]м))[^№\n,;])*№|(?:№|номер)\s*справки\s*[:№]?)\s*([\p{L}\p{N}]+(?:[-–—./][\p{L}\p{N}]+)*)/iu,
  )?.[1];
  return `${title}${certificateNumber ? ` № ${certificateNumber}` : ''} ${basis} № ${number} ${instrumental}${date ? ` от ${date}` : ''}`;
}
