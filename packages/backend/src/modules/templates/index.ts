import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  approvedStatementTemplate,
  datedBankruptcyPackage,
} from '@anyko/document-values/bankruptcy-statement';
import { employmentFields } from '@anyko/document-values/employment';
import {
  creditorRegistryColumns,
  obligationColumns,
} from '@anyko/document-values/obligations';
import { revisedBankruptcyPackages } from '@anyko/document-values/statement-layout';
import { DiagnosticError } from '@anyko/logger';

import { fieldDefinitions } from '../../profiles/bfl/fields';

import manifest from './assets/package.json';
import { type DocumentPackage, documentPackageSchema } from './schemas';
import { technicalBytes, technicalPackage } from './technical';
export type { DocumentPackage } from './schemas';
export type ReadTemplatePlaceholders = (
  pack: DocumentPackage,
) => Promise<DocumentPackage>;
export type ReadTemplateRequirements = (packageVersion: string) => Promise<
  {
    key: string;
    documentKind: string;
    label: string;
    applicability: 'usual' | 'conditional';
  }[]
>;
export { templateData } from './render-data';

const isCadastralColumn = (field: string, column: string) =>
  field === 'realEstate' && column === 'identifier';

const historicalPackage: DocumentPackage = documentPackageSchema.parse({
  id: 'bfl-bankruptcy',
  version: 'bfl-bankruptcy-v1',
  title: 'Банкротство гражданина',
  technical: false,
  fields: fieldDefinitions
    .filter(
      ({ key }) =>
        ![
          'personName',
          'registrationAddress',
          'observations',
          'cashOnHand',
          ...employmentFields,
          'submittedAttachments',
        ].includes(key),
    )
    .map((field) => ({
      ...field,
      columns: field.columns.filter(
        ({ key }) =>
          !Object.hasOwn(obligationColumns, key) &&
          !Object.hasOwn(creditorRegistryColumns, key) &&
          key !== 'category' &&
          !isCadastralColumn(field.key, key),
      ),
    })),
  documents: ['bfl-statement-v1', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
const previousPackage: DocumentPackage = documentPackageSchema.parse({
  ...historicalPackage,
  version: 'bfl-bankruptcy-v2',
  documents: ['bfl-statement-v2', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
const thirdPackage: DocumentPackage = documentPackageSchema.parse({
  ...historicalPackage,
  version: 'bfl-bankruptcy-v3',
  documents: ['bfl-statement-v3', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
const fourthPackage: DocumentPackage = documentPackageSchema.parse({
  ...historicalPackage,
  version: 'bfl-bankruptcy-v4',
  documents: ['bfl-statement-v4', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
const bankruptcyPackage: DocumentPackage = documentPackageSchema.parse({
  ...historicalPackage,
  version: 'bfl-bankruptcy-v5',
  documents: ['bfl-statement-v5', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
// The binding format changed. The document body and its approved asset are the same.
const amountPackage: DocumentPackage = documentPackageSchema.parse({
  ...bankruptcyPackage,
  version: 'bfl-bankruptcy-v6',
  fields: bankruptcyPackage.fields.filter(
    ({ key }) => key !== 'debtTotalWords',
  ),
  documents: bankruptcyPackage.documents.map((document) =>
    document.version === 'bfl-statement-v5'
      ? { ...document, version: 'bfl-statement-v6' }
      : document,
  ),
});
const obligationPackage: DocumentPackage = documentPackageSchema.parse({
  ...amountPackage,
  version: 'bfl-bankruptcy-v7',
  fields: fieldDefinitions
    .filter(
      ({ key }) =>
        !['debtTotal', 'employmentDetails'].includes(key) &&
        (amountPackage.fields.some((field) => field.key === key) ||
          employmentFields.some((field) => field === key)),
    )
    .map((field) => ({
      ...field,
      columns: field.columns.filter(
        ({ key }) => key !== 'category' && !isCadastralColumn(field.key, key),
      ),
    })),
  documents: ['bfl-statement-v7', 'bfl-inventory-v1', 'bfl-creditors-v2'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
const datedPackage: DocumentPackage = documentPackageSchema.parse({
  ...obligationPackage,
  version: datedBankruptcyPackage,
  fields: [
    ...obligationPackage.fields
      .filter(
        ({ key }) =>
          !['debtAsOfDate', 'requestsDetails', 'attachments'].includes(key),
      )
      .map((field) =>
        field.key === 'documentDate'
          ? { ...field, label: 'Дата заполнения комплекта' }
          : field,
      ),
    ...fieldDefinitions.filter(
      ({ key }) => key === 'attachments' || key === 'submittedAttachments',
    ),
  ],
  documents: obligationPackage.documents.map((document) =>
    document.id === 'statement'
      ? manifest.find(({ version }) => version === approvedStatementTemplate)
      : document,
  ),
});
const revisedStatementVersions = [
  'bfl-statement-v9',
  'bfl-statement-v10',
  'bfl-statement-v10',
  'bfl-statement-v11',
  'bfl-statement-v11',
];
const cadastralPackage = 'bfl-bankruptcy-v13';
const revisedPackages = revisedBankruptcyPackages.map((version, index) =>
  documentPackageSchema.parse({
    ...datedPackage,
    version,
    fields:
      index < 2
        ? datedPackage.fields
        : [
            ...datedPackage.fields.map((field) => {
              if (!['realEstate', 'vehicles', 'valuables'].includes(field.key))
                return field;
              const definition =
                fieldDefinitions.find(({ key }) => key === field.key) ?? field;
              return version === cadastralPackage
                ? definition
                : {
                    ...definition,
                    columns: definition.columns.filter(
                      ({ key }) => !isCadastralColumn(field.key, key),
                    ),
                  };
            }),
            ...fieldDefinitions.filter(({ key }) => key === 'cashOnHand'),
          ],
    documents: [
      manifest.find(
        ({ version }) => version === revisedStatementVersions[index],
      ),
      manifest.find(
        ({ version }) =>
          version === (index >= 2 ? 'bfl-inventory-v2' : 'bfl-inventory-v1'),
      ),
      manifest.find(
        ({ version }) =>
          version === (index >= 2 ? 'bfl-creditors-v3' : 'bfl-creditors-v2'),
      ),
    ],
  }),
);
export function availablePackages(): DocumentPackage[] {
  return [requirePackage(cadastralPackage)];
}
const knownPackages = [
  ...revisedPackages,
  datedPackage,
  obligationPackage,
  amountPackage,
  bankruptcyPackage,
  fourthPackage,
  thirdPackage,
  previousPackage,
  historicalPackage,
  technicalPackage,
];
export function hasPackage(version: string): boolean {
  return knownPackages.some((entry) => entry.version === version);
}
export function requirePackage(version: string): DocumentPackage {
  const pack = knownPackages.find((entry) => entry.version === version);
  if (!pack)
    throw new DiagnosticError({
      code: 'PACKAGE_NOT_FOUND',
      message: 'Версия пакета документов отсутствует в каталоге.',
      operation: 'templates.requirePackage',
    });
  return pack;
}
export function templateBytes(version: string): Uint8Array {
  if (version === technicalPackage.version) return technicalBytes(version);
  const assetVersion =
    version === 'bfl-statement-v6' ? 'bfl-statement-v5' : version;
  const template = manifest.find((item) => item.version === assetVersion);
  if (!template)
    throw new DiagnosticError({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Версия шаблона отсутствует в каталоге.',
      operation: 'templates.readAsset',
    });
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(
      new URL(
        `./assets/${template.version.replace(/^bfl-/, '')}.docx`,
        import.meta.url,
      ),
    );
  } catch (cause) {
    throw new DiagnosticError(
      {
        code: 'TEMPLATE_ASSET_READ_FAILED',
        message: 'Не удалось прочитать файл шаблона из поставки приложения.',
        operation: 'templates.readAsset',
      },
      { cause },
    );
  }
  if (createHash('sha256').update(bytes).digest('hex') !== template.checksum)
    throw new DiagnosticError({
      code: 'TEMPLATE_CHECKSUM_MISMATCH',
      message: 'Контрольная сумма файла шаблона отличается от утверждённой.',
      operation: 'templates.readAsset',
    });
  return bytes;
}
