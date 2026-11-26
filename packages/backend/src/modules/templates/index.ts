import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { DiagnosticError } from '@anyko/logger';

import { fieldDefinitions } from '../../profiles/bfl/fields';

import manifest from './assets/package.json';
import { bflPackages } from './bfl-catalog';
import type { DocumentPackage } from './schemas';
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

const { layoutPackage, revisedPackages } = bflPackages(fieldDefinitions);

export function availablePackages(): DocumentPackage[] {
  return [layoutPackage];
}
export const knownPackages = [
  layoutPackage,
  ...revisedPackages,
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
