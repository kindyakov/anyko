import type { AnalysisPlan } from '../../profiles/analysis-plan';
import type { FieldDefinition, FieldKey } from '../../profiles/fields';

export interface WorkAnalysisDefinition {
  fields: FieldDefinition[];
  excludedFields?: ReadonlySet<FieldKey> | undefined;
  plan: AnalysisPlan | undefined;
}
