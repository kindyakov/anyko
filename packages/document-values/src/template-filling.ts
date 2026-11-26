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
import { obligationFields, obligationTemplate } from './obligations';
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

const bflFillingLayouts = ['statement', 'inventory', 'creditors'] as const;
export type TemplateFilling = {
  functionId: 'bfl-v1';
  layout: (typeof bflFillingLayouts)[number];
  splitAttachments?: boolean | undefined;
};

type Definition = {
  filling?: TemplateFilling | undefined;
  fields: readonly FillingField[];
  attachments?: readonly PackageAttachment[] | undefined;
  placeholders?:
    readonly { tag: string; field: string; placeholder: string }[] | undefined;
};

const creditorHeaderColumns = ['name', 'inn', 'ogrn', 'address'];
const descriptionColumns = ['description'];

const templateFillers = {
  'bfl-v1': {
    accepts(parameters: Record<string, unknown>) {
      return (
        bflFillingLayouts.some((layout) => layout === parameters.layout) &&
        (parameters.splitAttachments === undefined ||
          typeof parameters.splitAttachments === 'boolean') &&
        Object.keys(parameters).every((key) =>
          ['functionId', 'layout', 'splitAttachments'].includes(key),
        )
      );
    },
    outputs(filling: TemplateFilling, fields: readonly FillingField[]) {
      const { layout, splitAttachments } = filling;
      const scalars = new Set(['signerName']);
      const builtInFormats = new Map<
        string,
        { field: string; placeholder: string }
      >();
      const repeats = new Map<string, readonly string[]>();
      const ownFields = new Set<string>();
      if (obligationTemplate(layout)) {
        scalars.add('debtTotal');
        scalars.add('debtTotalWords');
        // These catalog bindings describe outputs formatted by the filler.
        builtInFormats.set('debtTotal', {
          field: 'debtTotal',
          placeholder: 'RUB_DECIMAL',
        });
        builtInFormats.set('debtTotalWords', {
          field: 'debtTotal',
          placeholder: 'RUB_WORDS',
        });
        repeats.set('creditorHeaders', creditorHeaderColumns);
        for (const key of obligationFields) {
          const columns =
            fields.find((field) => field.key === key)?.columns ?? [];
          repeats.set(key, [
            ...columns.map((column) => column.key),
            'rowNumber',
          ]);
          if (columns.length) ownFields.add(key);
        }
      }
      if (bankruptcyStatement(layout)) {
        if (hasEmploymentFields(fields)) scalars.add('employmentDetails');
        for (const key of Object.keys({
          ...statementRequestValues({}),
          ...statementLayout(layout, {}),
        }))
          scalars.add(key);
        repeats.set('attachments', descriptionColumns);
        repeats.set('statementDebts', descriptionColumns);
        const attachments = fields.find(({ key }) => key === 'attachments');
        // Legacy BFL keeps this checklist field and projects it into the
        // statement using the submitted attachment choices.
        if (
          attachments?.columns.length === 2 &&
          attachments.columns.some(({ key }) => key === 'description') &&
          attachments.columns.some(({ key }) => key === 'category')
        )
          ownFields.add('attachments');
        if (splitAttachments) {
          repeats.set('attachmentTail', descriptionColumns);
          scalars.add('attachmentHeading');
        }
      }
      for (const [key, rows] of Object.entries(
        inventorySections(layout, {}, fields) ?? {},
      ))
        repeats.set(key, Object.keys(rows[0] ?? {}));
      return {
        scalars,
        builtInFormats,
        repeats,
        ownFields,
        sourceRowColumns({ key, columns }: FillingField) {
          return [
            ...collectionColumns(key, columns).map((column) => column.key),
            'rowNumber',
          ];
        },
      };
    },
  },
};

export function isTemplateFilling(value: unknown): value is TemplateFilling {
  if (typeof value !== 'object' || !value || !('functionId' in value))
    return false;
  const { functionId } = value;
  return (
    typeof functionId === 'string' &&
    Object.hasOwn(templateFillers, functionId) &&
    templateFillers[functionId as keyof typeof templateFillers].accepts(value)
  );
}

export function templateFillingOutputs(
  filling: Definition['filling'],
  fields: readonly FillingField[],
) {
  return (
    filling && templateFillers[filling.functionId].outputs(filling, fields)
  );
}

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

function collectionColumns(key: string, columns: FillingField['columns']) {
  return columns.filter(
    ({ key: column }) => key !== 'attachments' || column !== 'category',
  );
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
          collectionColumns(key, columns).map(({ key: cell }) => [
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
  if (statement && employmentDetails !== undefined)
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
          creditorHeaderColumns.map((key) => [
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
