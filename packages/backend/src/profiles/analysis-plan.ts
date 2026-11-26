export interface AnalysisGoal {
  key: string;
  title: string;
  kind: 'collect' | 'review';
  fields: readonly string[];
  instructions: string;
}

export interface AnalysisPlan {
  revision: string;
  steps: readonly AnalysisGoal[];
}

export function validateAnalysisPlan(
  plan: AnalysisPlan,
  fields: readonly string[],
) {
  const assigned = plan.steps.slice(0, -1).flatMap((step) => step.fields);
  if (
    plan.steps.at(-1)?.kind !== 'review' ||
    plan.steps.at(-1)?.fields.length !== 0 ||
    plan.steps
      .slice(0, -1)
      .some((step) => step.kind !== 'collect' || !step.fields.length) ||
    new Set(plan.steps.map(({ key }) => key)).size !== plan.steps.length ||
    new Set(assigned).size !== assigned.length ||
    !assigned.every((field) => fields.includes(field)) ||
    !fields.every((field) => assigned.includes(field))
  )
    throw new Error('INVALID_ANALYSIS_PLAN');
  return plan;
}
