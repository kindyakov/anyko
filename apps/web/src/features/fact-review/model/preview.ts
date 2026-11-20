import type {
  DocumentPackage,
  FieldValue,
  FieldValues,
  PreviewRow,
} from '@anyko/contracts/catalog';
import { attachmentDescriptions } from '@anyko/document-values/attachments';
import {
  approvedStatementTemplate,
  statementRequestValues,
} from '@anyko/document-values/bankruptcy-statement';
import {
  obligationAmounts,
  obligationTemplate,
} from '@anyko/document-values/obligations';

export function previewDocumentValues(version: string, values: FieldValues) {
  if (!obligationTemplate(version)) return null;
  const { debts, businessDebts, creditorHeaders, total, totalWords } =
    obligationAmounts(values.debts, values.businessDebts);
  const rows = {
    debts,
    businessDebts,
    creditorHeaders,
    ...(version === approvedStatementTemplate && {
      attachments: attachmentDescriptions(values.submittedAttachments),
    }),
  };
  const request =
    version === approvedStatementTemplate
      ? statementRequestValues(values)
      : undefined;
  const isCollection = (key: string | undefined): key is keyof typeof rows =>
    key !== undefined && Object.hasOwn(rows, key);
  return {
    isCollection,
    emptyNote: (key: string, collection: FieldValue) =>
      key === 'creditorHeaders' || collection !== null
        ? null
        : '[не заполнено]',
    value: (key: string) => (isCollection(key) ? rows[key] : values[key]),
    text: (key: string) => {
      if (key === 'debtTotal') return total ?? '[не заполнено]';
      if (key === 'debtTotalWords') return totalWords ?? '[не заполнено]';
      return request && Object.hasOwn(request, key) ? request[key] : undefined;
    },
  };
}

export function mentions(
  blocks: DocumentPackage['documents'][number]['blocks'],
) {
  const text = blocks
    .flatMap((block) =>
      block.kind === 'paragraph'
        ? [block.paragraph.text]
        : block.rows.flatMap((row) => [
            row.repeat ? `{#${row.repeat}}` : '',
            ...row.cells.flatMap((cell) => cell.paragraphs.map((p) => p.text)),
          ]),
    )
    .join(' ');
  return text;
}

export function previewEntries(
  row: PreviewRow,
  collection: FieldValue | undefined,
) {
  return row.repeat
    ? Array.isArray(collection)
      ? collection
      : [
          Object.fromEntries(
            row.cells.flatMap((cell) =>
              cell.paragraphs.flatMap((p) =>
                [...p.text.matchAll(/\{([^{}#/]+)\}/g)].map((m) => [
                  m[1] ?? '',
                  null,
                ]),
              ),
            ),
          ),
        ]
    : [undefined];
}
