import { attachmentDescriptions, type PackageAttachment } from './attachments';
import {
  formatBankruptcyMoney,
  formatBankruptcyScalar,
} from './bankruptcy-format';
import {
  bankruptcyCollectionCell,
  employmentStatement,
  formatPreviousNames,
  projectBankruptcyCollections,
  statementDefaults,
  usesBankruptcyProjection,
} from './bankruptcy-projection';
import {
  bankruptcyStatement,
  statementRequestValues,
  statementSroValues,
} from './bankruptcy-statement';
import { assessEmployment, hasEmploymentFields } from './employment';
import { inventorySections } from './inventory-layout';
import { obligationFields } from './obligations';
import {
  filingMoneyWords,
  omittedStatementAttachments,
  statementDebtNarratives,
  statementLayout,
  withFilingDateSuffix,
} from './statement-layout';
import { formatTemplateValue, missingTemplateValue } from './template-value';

type Row = Record<string, string | null>;
type Values = Readonly<Partial<Record<string, string | Row[] | null>>>;
type FillingField = { key: string; columns: readonly { key: string }[] };

export const bflFillingLayouts = [
  'statement',
  'inventory',
  'creditors',
] as const;
type BflFilling = {
  functionId: 'bfl-v1';
  layout: (typeof bflFillingLayouts)[number];
  splitAttachments?: boolean | undefined;
};

type Definition = {
  filling?: BflFilling | undefined;
  fields: readonly FillingField[];
  attachments?: readonly PackageAttachment[] | undefined;
  placeholders?:
    readonly { tag: string; field: string; placeholder: string }[] | undefined;
};

function signerName(values: Values, modern: boolean): string {
  const surname = typeof values.lastName === 'string' ? values.lastName : '';
  const last = (
    modern ? formatBankruptcyScalar('lastName', surname) : surname
  ).trim();
  const initials = [values.firstName, values.middleName]
    .flatMap((value) => {
      const initial =
        typeof value === 'string' && value.trim().match(/^\p{L}/u)?.[0];
      return initial ? [initial.toUpperCase() + '.'] : [];
    })
    .join('');
  return last
    ? [last, initials].filter(Boolean).join(' ')
    : missingTemplateValue;
}

function collectionSlots(
  fields: readonly FillingField[],
  values: Values,
  modern: boolean,
  emptyCell: string,
) {
  const repeating = new Map<string, Row[]>();
  for (const { key, columns } of fields) {
    if (!columns.length) continue;
    const value = Object.hasOwn(values, key) ? values[key] : null;
    const rows =
      Array.isArray(value) && value.length
        ? value
        : [
            Object.fromEntries(
              columns.map(({ key: cell }, index) => [
                cell,
                index === 0
                  ? value == null
                    ? missingTemplateValue
                    : 'Отсутствует'
                  : emptyCell,
              ]),
            ),
          ];
    repeating.set(
      key,
      rows.map((row, index) => ({
        ...Object.fromEntries(
          columns
            .filter(
              ({ key: cell }) => key !== 'attachments' || cell !== 'category',
            )
            .map(({ key: cell }) => [
              cell,
              bankruptcyCollectionCell(cell, row[cell], value, modern),
            ]),
        ),
        rowNumber:
          row.rowNumber ??
          (modern && Array.isArray(value) && !value.length
            ? '-'
            : String(index + 1)),
      })),
    );
  }
  return repeating;
}

export function prepareTemplate(
  {
    filling,
    fields,
    attachments: packageAttachments,
    placeholders = [],
  }: Definition,
  input: Values,
  context: {
    referenceDate: string;
    needsReview?: readonly string[] | undefined;
  },
) {
  const layout = filling?.layout;
  const statement = bankruptcyStatement(layout);
  const modern = usesBankruptcyProjection(layout);
  const values = { ...input };
  const defaults: Record<string, string> = statement
    ? statementDefaults(values)
    : {};
  const sro = statement ? statementSroValues(values) : {};
  Object.assign(values, sro);
  const employment =
    filling && hasEmploymentFields(fields)
      ? assessEmployment(values, context.referenceDate, context.needsReview)
      : undefined;
  const employmentDetails = employment
    ? statement
      ? employmentStatement(values, employment)
      : employment.statement
    : undefined;
  if (employmentDetails !== undefined)
    values.employmentDetails = employmentDetails;
  if (layout === 'inventory' || layout === 'creditors') {
    if (typeof values.previousNames === 'string')
      values.previousNames = formatPreviousNames(values.previousNames);
  }

  const scalars = new Map<string, string>();
  for (const { key, columns } of fields) {
    if (columns.length) continue;
    const value =
      (Object.hasOwn(values, key) ? values[key] : null) ??
      (Object.hasOwn(defaults, key) ? defaults[key] : null);
    scalars.set(
      key,
      typeof value === 'string'
        ? modern
          ? formatBankruptcyScalar(key, value)
          : value
        : missingTemplateValue,
    );
  }
  for (const { tag, field, placeholder } of placeholders) {
    if (placeholder === 'identity') continue;
    const value = Object.hasOwn(values, field) ? values[field] : null;
    scalars.set(
      tag,
      typeof value !== 'string'
        ? missingTemplateValue
        : modern && placeholder === 'RUB_DECIMAL'
          ? formatBankruptcyMoney(value)
          : formatTemplateValue(value, placeholder),
    );
  }

  const repeating = filling
    ? collectionSlots(
        fields,
        values,
        modern,
        layout === 'creditors' ? '-' : '—',
      )
    : new Map(
        fields
          .filter(({ columns }) => columns.length)
          .map(({ key }) => {
            const value = Object.hasOwn(values, key) ? values[key] : null;
            return [key, Array.isArray(value) ? value : []] as const;
          }),
      );
  const computed = new Map<string, Row[]>();
  const obligations = layout
    ? projectBankruptcyCollections(layout, values)
    : null;
  if (obligations) {
    for (const key of obligationFields) {
      const columns = fields.find((field) => field.key === key)?.columns ?? [];
      const rows = obligations[key];
      computed.set(
        key,
        rows.map((row, index) => ({
          ...Object.fromEntries(
            [
              ...new Set([
                ...columns.map(({ key }) => key),
                ...Object.keys(row),
              ]),
            ].map((cell) => [
              cell,
              bankruptcyCollectionCell(cell, row[cell], rows, modern),
            ]),
          ),
          rowNumber: row.rowNumber ?? String(index + 1),
        })),
      );
    }
    computed.set(
      'creditorHeaders',
      obligations.creditorHeaders.map((row) =>
        Object.fromEntries(
          ['name', 'inn', 'ogrn', 'address'].map((key) => [
            key,
            row[key] ?? missingTemplateValue,
          ]),
        ),
      ),
    );
    scalars.set('debtTotal', obligations.total ?? missingTemplateValue);
    scalars.set(
      'debtTotalWords',
      statement && obligations.total
        ? filingMoneyWords(obligations.total)
        : (obligations.totalWords ?? missingTemplateValue),
    );
  }
  if (statement) {
    const attachments = attachmentDescriptions(
      input.submittedAttachments,
      packageAttachments,
    ).map(({ description }) => ({
      description: withFilingDateSuffix(description),
    }));
    if (filling?.splitAttachments) {
      const tail = attachments.splice(-1);
      computed.set('attachmentTail', tail);
      scalars.set('attachmentHeading', tail.length ? 'Приложения:' : '');
    }
    computed.set('attachments', attachments);
    if (employmentDetails !== undefined)
      scalars.set(
        'employmentDetails',
        employmentDetails ?? missingTemplateValue,
      );
    for (const [key, value] of Object.entries({
      ...statementRequestValues(values),
      ...statementLayout(layout, input),
    }))
      scalars.set(key, value);
  }
  const narratives = statementDebtNarratives(layout, input);
  if (narratives) computed.set('statementDebts', narratives);
  for (const [key, rows] of Object.entries(
    inventorySections(layout, input, fields) ?? {},
  ))
    computed.set(key, rows);
  if (filling) scalars.set('signerName', signerName(values, modern));

  return {
    scalars: Object.fromEntries(scalars),
    repeating: Object.fromEntries([...repeating, ...computed]),
    computedRepeats: [...computed.keys()],
    defaults,
    sro,
    omittedAttachments: omittedStatementAttachments(layout, input),
  };
}
