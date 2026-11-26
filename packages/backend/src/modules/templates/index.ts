import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { DiagnosticError } from '@anyko/logger';

export type { DocumentPackage } from '../../profiles/template-schema';
export type ReadTemplateRequirements = (packageVersion: string) => Promise<
  {
    key: string;
    documentKind: string;
    label: string;
    applicability: 'usual' | 'conditional';
  }[]
>;

export { technicalBytes, technicalDescription } from './technical';
export {
  parsePackagePublication,
  validatePackageDescription,
} from './validate-package-description';

export function readTemplateAsset(file: string, checksum: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(new URL(`./assets/${file}`, import.meta.url));
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
  if (createHash('sha256').update(bytes).digest('hex') !== checksum)
    throw new DiagnosticError({
      code: 'TEMPLATE_CHECKSUM_MISMATCH',
      message: 'Контрольная сумма файла шаблона отличается от утверждённой.',
      operation: 'templates.readAsset',
    });
  return bytes;
}
