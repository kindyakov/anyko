import { isDatedBankruptcyPackage } from '@anyko/document-values/statement-layout';

import type { FieldDefinition } from '../fields';

import { bflAnalysisPlan } from './analysis-plan';

export function resolveBflAnalysis(
  pack: { version: string; fields: FieldDefinition[] },
  stepwise: boolean,
) {
  const excludedFields = isDatedBankruptcyPackage(pack.version)
    ? new Set(
        pack.fields
          .filter(({ key }) => key === 'documentDate' || key.startsWith('sro'))
          .map(({ key }) => key),
      )
    : undefined;
  const fields = pack.fields.filter(({ key }) => !excludedFields?.has(key));
  const plan = stepwise ? bflAnalysisPlan(pack.version, fields) : undefined;
  return { fields, excludedFields, plan };
}
