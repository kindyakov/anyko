import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  bflLayoutPackage,
  bflLayoutTemplates,
  revisedBankruptcyPackages,
} from '@anyko/document-values/statement-layout';
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

const revisedPackages = revisedBankruptcyPackages.map((version) =>
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
    ].map((version) => manifest.find((doc) => doc.version === version)),
  }),
);
const layoutPackage = documentPackageSchema.parse({
  ...revisedPackages.find(({ version }) => version === cadastralPackage),
  version: bflLayoutPackage,
  documents: Object.keys(bflLayoutTemplates).map((version) =>
    manifest.find((document) => document.version === version),
  ),
});
export function availablePackages(): DocumentPackage[] {
  return [layoutPackage];
}
const knownPackages = [layoutPackage, ...revisedPackages, technicalPackage];
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
  const template = manifest.find((item) => item.version === version);
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
