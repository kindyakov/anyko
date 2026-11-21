import type {
  DocumentPackage,
  FieldKey,
  FieldValue,
  FieldValues,
  PreviewRow,
} from '@anyko/contracts/catalog';
import { attachmentDescriptions } from '@anyko/document-values/attachments';
import {
  employmentStatement,
  familyStatement,
  formatPreviousNames,
  projectBankruptcyCollections,
  statementDefaultValue,
  usesBankruptcyProjection,
} from '@anyko/document-values/bankruptcy-projection';
import {
  bankruptcyStatement,
  statementRequestValues,
  statementSroValues,
} from '@anyko/document-values/bankruptcy-statement';
import {
  assessEmployment,
  hasEmploymentFields,
} from '@anyko/document-values/employment';
import { inventorySections } from '@anyko/document-values/inventory-layout';
import {
  filingMoneyWords,
  isDatedBankruptcyPackage,
  revisedStatementTemplate,
  statementDebtNarratives,
  statementLayout,
  withFilingDateSuffix,
} from '@anyko/document-values/statement-layout';

export function previewStatementValues(
  pack: DocumentPackage,
  documentId: string,
  values: FieldValues,
  needsReview?: readonly FieldKey[],
): FieldValues {
  if (documentId !== 'statement') return values;
  const modern = isDatedBankruptcyPackage(pack.version);
  const statementVersion = pack.documents.find(
    ({ id }) => id === documentId,
  )?.version;
  const employment = hasEmploymentFields(pack.fields)
    ? assessEmployment(values, undefined, needsReview)
    : undefined;
  return {
    ...values,
    ...(modern && statementSroValues(values)),
    ...(employment && {
      employmentDetails: modern
        ? employmentStatement(
            values,
            employment,
            revisedStatementTemplate(statementVersion),
          )
        : employment.statement,
    }),
  };
}

export function previewDocumentValues(
  version: string,
  values: FieldValues,
  fields: DocumentPackage['fields'],
) {
  const modern = usesBankruptcyProjection(version, fields);
  const obligations = projectBankruptcyCollections(version, values, modern);
  if (!modern && !obligations) return null;
  const statement = bankruptcyStatement(version);
  const revised = revisedStatementTemplate(version);
  const narratives = statementDebtNarratives(version, values);
  const rows: FieldValues = {
    ...(obligations && {
      debts: obligations.debts,
      businessDebts: obligations.businessDebts,
      creditorHeaders: obligations.creditorHeaders,
    }),
    ...(statement && {
      attachments: attachmentDescriptions(values.submittedAttachments).map(
        ({ description }) => ({
          description: revised
            ? withFilingDateSuffix(description)
            : description,
        }),
      ),
    }),
    ...(narratives && { statementDebts: narratives }),
    ...inventorySections(version, values, fields),
  };
  const request: Record<string, string> = {
    ...(statement && statementRequestValues(values)),
    ...statementLayout(version, values),
  };
  const isCollection = (key: string | undefined) =>
    key !== undefined && Object.hasOwn(rows, key);
  return {
    modern,
    isCollection,
    emptyNote: (key: string, collection: FieldValue) =>
      key === 'creditorHeaders' || collection !== null
        ? null
        : '[не заполнено]',
    value: (key: string) => (isCollection(key) ? rows[key] : values[key]),
    defaultText: (key: string) =>
      statement ? statementDefaultValue(values, key) : undefined,
    translatedText: (key: string, value: string) => {
      if (statement && key === 'familyDetails') return familyStatement(value);
      if (
        (version === 'bfl-creditors-v3' || version === 'bfl-inventory-v2') &&
        key === 'previousNames'
      )
        return formatPreviousNames(value);
      return value;
    },
    text: (key: string) => {
      if (obligations && key === 'debtTotal')
        return obligations.total ?? '[не заполнено]';
      if (obligations && key === 'debtTotalWords')
        return revised && obligations.total
          ? filingMoneyWords(obligations.total)
          : (obligations.totalWords ?? '[не заполнено]');
      return Object.hasOwn(request, key) ? request[key] : undefined;
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
