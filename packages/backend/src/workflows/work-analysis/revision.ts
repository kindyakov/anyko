import { createHash } from 'node:crypto';

import {
  analysisPolicyRevisionInput,
  type FieldDefinition,
} from '../../modules/agents';
import type { AnalysisPlan } from '../../profiles/analysis-plan';
import type { WorkPackage } from '../work-package';

export function workAnalysisRevision(
  fields: readonly FieldDefinition[],
  plan: AnalysisPlan | undefined,
  profile: WorkPackage['profile'],
) {
  return digest([
    profile,
    fields,
    plan,
    analysisPolicyRevisionInput(fields, !!plan),
  ]);
}

export function digest(input: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
