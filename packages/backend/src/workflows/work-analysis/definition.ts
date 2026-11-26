import type { AgentPolicy } from '../../profiles/agent-policy';
import type { AnalysisPlan } from '../../profiles/analysis-plan';
import type { FieldDefinition, FieldKey } from '../../profiles/fields';

export interface WorkAnalysisDefinition {
  fields: FieldDefinition[];
  policy: AgentPolicy;
  excludedFields?: ReadonlySet<FieldKey> | undefined;
  plan: AnalysisPlan | undefined;
}
