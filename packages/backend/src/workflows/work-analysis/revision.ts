import { createHash } from 'node:crypto';

import {
  analysisPolicyRevisionInput,
  type FieldDefinition,
} from '../../modules/agents';
import type { AnalysisPlan } from '../../profiles/analysis-plan';

export function workAnalysisRevision(
  fields: readonly FieldDefinition[],
  plan: AnalysisPlan | undefined,
) {
  return digest([fields, plan, analysisPolicyRevisionInput(fields, !!plan)]);
}

export function digest(input: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
