import { attachmentDescriptions } from '@anyko/document-values/attachments';
import {
  formatBankruptcyMoney,
  formatBankruptcyScalar,
} from '@anyko/document-values/bankruptcy-format';
import {
  bankruptcyCollectionCell,
  employmentStatement,
  formatPreviousNames,
  projectBankruptcyCollections,
  statementDefaults,
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
import { obligationFields } from '@anyko/document-values/obligations';
import {
  bflContentTemplate,
  filingMoneyWords,
  revisedStatementTemplate,
  statementDebtNarratives,
  statementLayout,
  withFilingDateSuffix,
} from '@anyko/document-values/statement-layout';
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
  assetVersion?: string,
  placeholders: readonly TemplatePlaceholder[] = [],
  context?: {
    fields: readonly { key: string; columns?: readonly { key: string }[] }[];
    referenceDate: string;
  },
): FieldValues & {
  signerName: string;
  creditorHeaders?: FieldValues['debts'];
} {
  const templateVersion = assetVersion && bflContentTemplate(assetVersion);
  const values = readFieldValues(input);
  if (
    (templateVersion === 'bfl-creditors-v3' ||
      templateVersion === 'bfl-inventory-v2') &&
    typeof values.previousNames === 'string'
  )
    values.previousNames = formatPreviousNames(values.previousNames);
  const statement = bankruptcyStatement(templateVersion);
  const revised = revisedStatementTemplate(templateVersion);
  const modern = usesBankruptcyProjection(templateVersion, context?.fields);
  const emptyCell = templateVersion === 'bfl-creditors-v3' ? '-' : '—';
  const defaults: Record<string, string> = statement
    ? statementDefaults(values)
    : {};
  if (statement) Object.assign(values, statementSroValues(values));
  const output = emptyFieldValues();
  if (statement)
    values.attachments = attachmentDescriptions(
      values.submittedAttachments,
    ).map(({ description }) => ({
      description: revised ? withFilingDateSuffix(description) : description,
    }));
  if (context && hasEmploymentFields(context.fields)) {
    const employment = assessEmployment(values, context.referenceDate);
    values.employmentDetails = statement
      ? employmentStatement(values, employment, revised)
      : employment.statement;
  }
  const obligations = templateVersion
    ? projectBankruptcyCollections(templateVersion, values, modern)
    : null;
  if (obligations) {
    for (const field of obligationFields) values[field] = obligations[field];
  }
  for (const field of fieldDefinitions) {
    const value = values[field.key] ?? defaults[field.key] ?? null;
    if (
      (templateVersion === 'bfl-statement-v4' ||
        templateVersion === 'bfl-statement-v5' ||
        templateVersion === 'bfl-statement-v6' ||
        obligations ||
        (statement && field.key === 'attachments')) &&
      Array.isArray(value) &&
      !value.length &&
      ['debts', 'businessDebts', 'attachments'].includes(field.key)
    ) {
      output[field.key] = [];
      continue;
    }
    if (!field.columns.length) {
      output[field.key] =
        typeof value === 'string'
          ? modern
            ? formatBankruptcyScalar(field.key, value)
            : value
          : '[не заполнено]';
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
                  : emptyCell,
              ]),
            ),
          ];
    output[field.key] = rows.map((row, index) => ({
      ...Object.fromEntries(
        field.columns
          .filter(
            ({ key }) => field.key !== 'attachments' || key !== 'category',
          )
          .map(({ key }) => [
            key,
            bankruptcyCollectionCell(key, row[key], value, modern),
          ]),
      ),
      rowNumber:
        row.rowNumber ??
        (modern && Array.isArray(value) && !value.length
          ? '-'
          : String(index + 1)),
    }));
  }
  for (const { tag, field, placeholder } of placeholders) {
    if (placeholder === 'identity') continue;
    const value = values[field];
    Object.assign(output, {
      [tag]:
        typeof value === 'string'
          ? modern && placeholder === 'RUB_DECIMAL'
            ? formatBankruptcyMoney(value)
            : formatTemplateValue(value, placeholder)
          : '[не заполнено]',
    });
  }
  if (obligations) {
    output.debtTotal = obligations.total ?? '[не заполнено]';
    output.debtTotalWords =
      revised && obligations.total
        ? filingMoneyWords(obligations.total)
        : (obligations.totalWords ?? '[не заполнено]');
  }
  const surname =
    typeof values.lastName === 'string'
      ? (modern
          ? formatBankruptcyScalar('lastName', values.lastName)
          : values.lastName
        ).trim()
      : '';
  const initials = [values.firstName, values.middleName]
    .map((value) =>
      typeof value === 'string'
        ? value.trim().match(/^\p{L}/u)?.[0]
        : undefined,
    )
    .flatMap((initial) => (initial ? [`${initial.toUpperCase()}.`] : []))
    .join('');
  const narratives = statementDebtNarratives(templateVersion, input);
  const attachmentTail =
    assetVersion === 'bfl-statement-v12' && Array.isArray(output.attachments)
      ? output.attachments.splice(-1)
      : [];
  return {
    ...output,
    ...(assetVersion === 'bfl-statement-v12' && {
      attachmentTail,
      attachmentHeading: attachmentTail.length ? 'Приложения:' : '',
    }),
    ...(statement && statementRequestValues(values)),
    ...statementLayout(templateVersion, input),
    ...(narratives && { statementDebts: narratives }),
    ...inventorySections(templateVersion, input, context?.fields),
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
