import {
  bflContentTemplate,
  bflLayoutPackage,
  bflLayoutTemplates,
  revisedBankruptcyPackages,
} from '@anyko/document-values/statement-layout';
import { bflFillingLayouts } from '@anyko/document-values/template-filling';

import { fieldDefinitions } from '../../profiles/bfl/fields';

import manifest from './assets/package.json';
import { documentPackageSchema } from './schemas';

const cadastralPackage = 'bfl-bankruptcy-v13';
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

function withFilling(version: string) {
  const asset = manifest.find((document) => document.version === version);
  const contentVersion = bflFillingLayouts.find(
    (layout) => layout === bflContentTemplate(version),
  );
  if (!asset || !contentVersion) throw new Error('BFL_TEMPLATE_MISSING');
  return {
    ...asset,
    filling: {
      functionId: 'bfl-v1',
      contentVersion,
      ...(version === 'bfl-statement-v12' && { splitAttachments: true }),
    },
  };
}

export const revisedPackages = revisedBankruptcyPackages.map((version) =>
  documentPackageSchema.parse({
    id: 'bfl-bankruptcy',
    version,
    title: 'Банкротство гражданина',
    technical: false,
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
              return version === cadastralPackage;
            return true;
          }),
        })),
      ...finalFields.map((key) =>
        fieldDefinitions.find((field) => field.key === key),
      ),
    ],
    documents: [
      'bfl-statement-v11',
      'bfl-inventory-v2',
      'bfl-creditors-v3',
    ].map(withFilling),
  }),
);
export const layoutPackage = documentPackageSchema.parse({
  ...revisedPackages.find(({ version }) => version === cadastralPackage),
  version: bflLayoutPackage,
  documents: Object.keys(bflLayoutTemplates).map(withFilling),
});
