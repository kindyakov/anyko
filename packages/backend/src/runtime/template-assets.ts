import { DiagnosticError } from '@anyko/logger';

import {
  type DocumentPackage,
  readTemplateAsset,
  technicalBytes,
  technicalDescription,
} from '../modules/templates';
import {
  bflPackageDescriptions,
  defaultBflPackage,
} from '../profiles/bfl/package-descriptions';
import manifest from '../profiles/bfl/template-previews.json';
export function availablePackages(): DocumentPackage[] {
  return [defaultBflPackage.package];
}
const technicalPackage = technicalDescription.package;
export const knownPackages = [
  ...bflPackageDescriptions.map(({ package: pack }) => pack),
  technicalPackage,
];
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
  return readTemplateAsset(
    template.version.replace(/^bfl-/, '') + '.docx',
    template.checksum,
  );
}
