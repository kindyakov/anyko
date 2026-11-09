import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  type DocumentPackage,
  documentPackageSchema,
  fieldDefinitions,
} from '@anyko/contracts';

import manifest from './assets/package.json';
import { technicalBytes, technicalPackage } from './technical';
export { templateData } from './render-data';

const historicalPackage: DocumentPackage = documentPackageSchema.parse({
  id: 'bfl-bankruptcy',
  version: 'bfl-bankruptcy-v1',
  title: 'Банкротство гражданина',
  technical: false,
  fields: fieldDefinitions.filter(
    ({ key }) =>
      !['personName', 'registrationAddress', 'observations'].includes(key),
  ),
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
const bankruptcyPackage: DocumentPackage = documentPackageSchema.parse({
  ...historicalPackage,
  version: 'bfl-bankruptcy-v3',
  documents: ['bfl-statement-v3', 'bfl-inventory-v1', 'bfl-creditors-v1'].map(
    (version) => manifest.find((doc) => doc.version === version),
  ),
});
export function availablePackages(): DocumentPackage[] {
  return [bankruptcyPackage];
}
export function requirePackage(version: string): DocumentPackage {
  const pack = [
    bankruptcyPackage,
    previousPackage,
    historicalPackage,
    technicalPackage,
  ].find((entry) => entry.version === version);
  if (!pack) throw new Error('PACKAGE_NOT_FOUND');
  return pack;
}
export function templateBytes(version: string): Uint8Array {
  if (version === technicalPackage.version) return technicalBytes(version);
  const template = manifest.find((item) => item.version === version);
  if (!template) throw new Error('TEMPLATE_NOT_FOUND');
  const bytes = readFileSync(
    new URL(
      `./assets/${template.version.replace(/^bfl-/, '')}.docx`,
      import.meta.url,
    ),
  );
  if (createHash('sha256').update(bytes).digest('hex') !== template.checksum)
    throw new Error('TEMPLATE_CHECKSUM_MISMATCH');
  return bytes;
}
