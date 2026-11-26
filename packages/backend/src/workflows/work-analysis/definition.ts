import { isDatedBankruptcyPackage } from '@anyko/document-values/statement-layout';

import type { FieldDefinition } from '../../modules/agents';
import { requirePackage } from '../../modules/templates';
import type { AnalysisPlan } from '../../profiles/analysis-plan';
import { bflAnalysisPlan } from '../../profiles/bfl/analysis-plan';
import type { FieldKey } from '../../profiles/bfl/fields';

export interface WorkAnalysisDefinition {
  fields: FieldDefinition[];
  excludedFields: ReadonlySet<FieldKey> | undefined;
  plan: AnalysisPlan | undefined;
}

export function resolveWorkAnalysis(
  version: string,
  stepwise: boolean,
): WorkAnalysisDefinition {
  const pack = requirePackage(version);
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
