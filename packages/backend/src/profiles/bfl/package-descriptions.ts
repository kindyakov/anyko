import { packageAttachments } from '@anyko/document-values/attachments';

import type { PackageDescription } from '../package-description';
import { documentPackageSchema } from '../template-schema';

import { bflAgentPolicy } from './agent-policy';
import { bflAnalysisPlan } from './analysis-plan';
import { fieldDefinitions } from './fields';
import metadata from './template-bindings.json';
import manifest from './template-previews.json';

const propertyFields = ['realEstate', 'vehicles', 'valuables'];
const computedOrTechnicalFields = [
  'personName',
  'registrationAddress',
  'observations',
  'debtTotalWords',
  'debtTotal',
  'employmentDetails',
  'debtAsOfDate',
  'requestsDetails',
];
const finalFields = ['attachments', 'submittedAttachments', 'cashOnHand'];

type TemplateVersion = keyof typeof metadata;
type Filling = NonNullable<
  PackageDescription['package']['documents'][number]['filling']
>;
type Template = readonly [TemplateVersion, Filling['layout'], boolean?];

const revisedTemplates = [
  ['bfl-statement-v11', 'statement'],
  ['bfl-inventory-v2', 'inventory'],
  ['bfl-creditors-v3', 'creditors'],
] as const satisfies readonly Template[];

function describe(
  version: string,
  templates: readonly Template[],
  { cadastral, stepwise }: { cadastral: boolean; stepwise: boolean },
): PackageDescription {
  const pack = documentPackageSchema.parse({
    id: 'bfl-bankruptcy',
    version,
    title: 'Банкротство гражданина',
    technical: false,
    defaultDocumentDate: true,
    attachments: packageAttachments,
    fields: [
      ...fieldDefinitions
        .filter(
          ({ key }) =>
            !computedOrTechnicalFields.includes(key) &&
            !finalFields.includes(key),
        )
        .map((field) => ({
          ...field,
          label:
            field.key === 'documentDate'
              ? 'Дата заполнения комплекта'
              : field.label,
          columns: field.columns.filter(({ key }) => {
            if (key === 'category') return propertyFields.includes(field.key);
            if (key === 'identifier' && field.key === 'realEstate')
              return cadastral;
            return true;
          }),
        })),
      ...finalFields.map((key) =>
        fieldDefinitions.find((field) => field.key === key),
      ),
    ],
    documents: templates.map(([templateVersion, layout, splitAttachments]) => {
      const asset = manifest.find(({ version }) => version === templateVersion);
      if (!asset) throw new Error('BFL_TEMPLATE_MISSING');
      return {
        ...asset,
        placeholders: metadata[templateVersion].placeholders,
        filling: { functionId: 'bfl-v1', layout, splitAttachments },
      };
    }),
  });
  const excludedFields = pack.fields
    .filter(({ key }) => key === 'documentDate' || key.startsWith('sro'))
    .map(({ key }) => key);
  const fields = pack.fields.filter(({ key }) => !excludedFields.includes(key));
  return {
    package: pack,
    requirements: Object.fromEntries(
      templates.map(([version]) => [
        version,
        metadata[version]
          .requirements as PackageDescription['requirements'][string],
      ]),
    ),
    analysis: {
      excludedFields,
      plan: stepwise ? bflAnalysisPlan(fields) : undefined,
      instructions: {
        extraction: bflAgentPolicy.extraction?.(fields) ?? '',
        reconciliation: bflAgentPolicy.reconciliation?.(fields, false) ?? '',
        reconciliationWithChecklist:
          bflAgentPolicy.reconciliation?.(fields, true) ?? '',
        chat: bflAgentPolicy.chat?.(fields) ?? '',
      },
    },
  };
}

export const defaultBflPackage = describe(
  'bfl-bankruptcy-v14',
  [
    ['bfl-statement-v12', 'statement', true],
    ['bfl-inventory-v3', 'inventory'],
    ['bfl-creditors-v4', 'creditors'],
  ],
  { cadastral: true, stepwise: true },
);

export const bflPackageDescriptions = [
  defaultBflPackage,
  describe('bfl-bankruptcy-v12', revisedTemplates, {
    cadastral: false,
    stepwise: false,
  }),
  describe('bfl-bankruptcy-v13', revisedTemplates, {
    cadastral: true,
    stepwise: true,
  }),
];
