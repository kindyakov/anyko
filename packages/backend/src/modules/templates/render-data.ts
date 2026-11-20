import { attachmentDescriptions } from '@anyko/document-values/attachments';
import {
  approvedStatementTemplate,
  statementRequestValues,
  statementSroValues,
} from '@anyko/document-values/bankruptcy-statement';
import {
  assessEmployment,
  hasEmploymentFields,
} from '@anyko/document-values/employment';
import {
  obligationAmounts,
  obligationFields,
  obligationTemplate,
} from '@anyko/document-values/obligations';
import { formatTemplateValue } from '@anyko/document-values/template-value';

import {
  emptyFieldValues,
  fieldDefinitions,
  type FieldValues,
  readFieldValues,
} from '../../profiles/bfl/fields';

import type { TemplatePlaceholder } from './schemas';

/** Projection only: unknown values stay visibly unknown; no legal or financial inference. */
export function templateData(
  input: FieldValues,
  templateVersion?: string,
  placeholders: readonly TemplatePlaceholder[] = [],
  context?: { fields: readonly { key: string }[]; referenceDate: string },
): FieldValues & {
  signerName: string;
  creditorHeaders?: FieldValues['debts'];
} {
  const values = readFieldValues(input);
  if (templateVersion === approvedStatementTemplate)
    Object.assign(values, statementSroValues(values));
  const output = emptyFieldValues();
  const submitted = templateVersion === approvedStatementTemplate;
  if (submitted)
    values.attachments = attachmentDescriptions(values.submittedAttachments);
  if (context && hasEmploymentFields(context.fields)) {
    values.employmentDetails = assessEmployment(
      values,
      context.referenceDate,
    ).statement;
  }
  const obligations = obligationTemplate(templateVersion)
    ? obligationAmounts(values.debts, values.businessDebts)
    : null;
  if (obligations) {
    for (const field of obligationFields) values[field] = obligations[field];
  }
  for (const field of fieldDefinitions) {
    const value = values[field.key];
    if (
      (templateVersion === 'bfl-statement-v4' ||
        templateVersion === 'bfl-statement-v5' ||
        templateVersion === 'bfl-statement-v6' ||
        obligationTemplate(templateVersion) ||
        (submitted && field.key === 'attachments')) &&
      Array.isArray(value) &&
      !value.length &&
      ['debts', 'businessDebts', 'attachments'].includes(field.key)
    ) {
      output[field.key] = [];
      continue;
    }
    if (!field.columns.length) {
      output[field.key] = typeof value === 'string' ? value : '[не заполнено]';
      continue;
    }
    const rows =
      Array.isArray(value) && value.length
        ? value
        : [
            Object.fromEntries(
              field.columns.map(({ key }, i) => [
                key,
                i === 0
                  ? value === null
                    ? '[не заполнено]'
                    : 'Отсутствует'
                  : '—',
              ]),
            ),
          ];
    output[field.key] = rows.map((row, index) => ({
      ...Object.fromEntries(
        field.columns
          .filter(
            ({ key }) => field.key !== 'attachments' || key !== 'category',
          )
          .map(({ key }) => [key, row[key] ?? '[не заполнено]']),
      ),
      rowNumber: String(index + 1),
    }));
  }
  for (const { tag, field, placeholder } of placeholders) {
    if (placeholder === 'identity') continue;
    const value = values[field];
    Object.assign(output, {
      [tag]:
        typeof value === 'string'
          ? formatTemplateValue(value, placeholder)
          : '[не заполнено]',
    });
  }
  if (obligations) {
    output.debtTotal = obligations.total ?? '[не заполнено]';
    output.debtTotalWords = obligations.totalWords ?? '[не заполнено]';
  }
  const surname =
    typeof values.lastName === 'string' ? values.lastName.trim() : '';
  const initials = [values.firstName, values.middleName]
    .map((value) =>
      typeof value === 'string'
        ? value.trim().match(/^\p{L}/u)?.[0]
        : undefined,
    )
    .flatMap((initial) => (initial ? [`${initial.toUpperCase()}.`] : []))
    .join('');
  return {
    ...output,
    ...(templateVersion === approvedStatementTemplate &&
      statementRequestValues(values)),
    ...(obligations && {
      creditorHeaders: obligations.creditorHeaders.map((row) =>
        Object.fromEntries(
          ['name', 'inn', 'ogrn', 'address'].map((key) => [
            key,
            row[key] ?? '[не заполнено]',
          ]),
        ),
      ),
    }),
    signerName: surname
      ? `${surname}${initials ? ` ${initials}` : ''}`
      : '[не заполнено]',
  };
}
