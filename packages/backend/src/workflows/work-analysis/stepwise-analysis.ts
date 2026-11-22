import { LlmError } from '@anyko/llm';

import type {
  AnalysisStepInput,
  DocumentAgents,
  WorkFacts,
} from '../../modules/agents';
import { markSelectedCandidates } from '../../modules/facts';
import type { AnalysisCheckpoint, WorkAttempt } from '../../modules/processing';
import { isAppError } from '../../platform/errors';
import type { AnalysisPlan } from '../../profiles/analysis-plan';

import { addUsage } from './model-call';

type ModelStep = NonNullable<DocumentAgents['runAnalysisStep']>;
type TurnInput = Omit<
  AnalysisStepInput,
  | 'step'
  | 'completedSteps'
  | 'proposeFacts'
  | 'reportDiscrepancy'
  | 'currentFacts'
  | 'review'
>;

function appendProposals(
  before: WorkFacts['candidates'],
  next: WorkFacts['candidates'],
) {
  return [
    ...new Map(
      [...before, ...next].map((candidate) => [
        JSON.stringify(candidate),
        candidate,
      ]),
    ).values(),
  ];
}

function proposalResult(
  statuses: string[],
  fields: Parameters<AnalysisStepInput['proposeFacts']>[3],
  proposals: Parameters<AnalysisStepInput['proposeFacts']>[1],
  facts: WorkFacts,
): Awaited<ReturnType<AnalysisStepInput['proposeFacts']>> {
  const selected = markSelectedCandidates({
    ...facts,
    candidates: proposals.map(({ candidate }) => candidate),
  });
  const byPosition = new Map(
    proposals.map(({ index }, i) => [index, selected[i]]),
  );
  return {
    statuses,
    feedback: fields.map((field, index) => {
      const value = facts.values[field];
      const fieldEmpty = value === null;
      const status = statuses[index];
      const candidate = byPosition.get(index);
      if (status !== 'saved')
        return { field, fieldEmpty, disposition: 'rejected', reason: status };
      if (candidate?.origin === 'inference')
        return {
          field,
          fieldEmpty,
          disposition: 'saved_for_review',
          reason: 'inference_requires_lawyer',
        };
      if (
        !candidate?.selected ||
        (Array.isArray(candidate.value) &&
          !candidate.value.length &&
          Array.isArray(value) &&
          value.length > 0)
      )
        return {
          field,
          fieldEmpty,
          disposition: 'saved_for_review',
          reason: 'value_not_projected',
        };
      return { field, fieldEmpty, disposition: 'value_projected' };
    }),
  };
}

export async function runStepwiseAnalysis(input: {
  plan: AnalysisPlan;
  attempt: WorkAttempt;
  fingerprint: string;
  model: ModelStep;
  turn: TurnInput;
  projectFacts(candidates: WorkFacts['candidates']): WorkFacts;
  writeCheckpoint(
    candidates: WorkFacts['candidates'],
    checkpoint: AnalysisCheckpoint,
  ): Promise<void>;
}) {
  const { plan, attempt, turn } = input;
  const stored = await attempt.analysisCheckpoint();
  const saved = stored?.analysisCheckpoint;
  type Checkpoint = AnalysisCheckpoint;
  let checkpoint: Checkpoint =
    saved?.fingerprint === input.fingerprint
      ? saved
      : {
          fingerprint: input.fingerprint,
          finished: [],
          receipts: [],
          pendingCandidates: [],
          discrepancies: [],
          inputTokens: 0,
          outputTokens: 0,
        };
  let completed =
    saved?.fingerprint === input.fingerprint ? (stored?.candidates ?? []) : [];
  const save = async (next: Checkpoint, candidates = completed) => {
    await input.writeCheckpoint(candidates, next);
    checkpoint = next;
    completed = candidates;
  };
  let writes = Promise.resolve();
  const serialize = <T>(apply: () => Promise<T>) => {
    const result = writes.then(apply);
    writes = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const automaticFields = new Set(plan.steps.flatMap(({ fields }) => fields));
  const protectedFields = new Set([
    ...turn.facts.manual,
    ...turn.facts.confirmed,
  ]);
  let failure:
    | {
        step: string;
        errorCode: string;
        unreportedFields?: string[];
        limit?: 'model_calls' | 'reads';
      }
    | undefined;
  const setReviewFailure = (
    step: string,
    outcome: NonNullable<AnalysisCheckpoint['reviewOutcome']>,
  ) => {
    if (outcome.errorCode || outcome.unreportedFields.length || outcome.limit) {
      failure = {
        step,
        errorCode:
          outcome.errorCode ??
          (outcome.unreportedFields.length
            ? 'ANALYSIS_REVIEW_INCOMPLETE'
            : outcome.limit === 'reads'
              ? 'LLM_READ_LIMIT'
              : 'LLM_STEP_LIMIT'),
        unreportedFields: outcome.unreportedFields,
        ...(outcome.limit && { limit: outcome.limit }),
      };
    }
  };
  for (const step of plan.steps) {
    if (checkpoint.finished.some(({ key }) => key === step.key)) continue;
    if (step.kind === 'review' && checkpoint.reviewOutcome) {
      setReviewFailure(step.key, checkpoint.reviewOutcome);
      break;
    }
    try {
      const review = step.kind === 'review';
      let reviewValues = review
        ? input.projectFacts(
            appendProposals(completed, checkpoint.pendingCandidates),
          ).values
        : undefined;
      const reviewFields = reviewValues
        ? turn.fields
            .filter(
              ({ key }) =>
                automaticFields.has(key) &&
                !protectedFields.has(key) &&
                turn.facts.values[key] === null &&
                reviewValues?.[key] === null,
            )
            .map(({ key }) => key)
        : [];
      const remainingFields = () =>
        reviewFields.filter((field) => reviewValues?.[field] === null);
      const uncoveredFields = () => {
        const explained = new Set(
          (checkpoint.reviewReasons ?? []).map(({ field }) => field),
        );
        return remainingFields().filter((field) => !explained.has(field));
      };
      const result = await input
        .model({
          ...turn,
          step,
          completedSteps: checkpoint.finished.map(({ key, summary }) => ({
            key,
            summary: summary.slice(0, 400),
          })),
          currentFacts: () =>
            Promise.resolve({
              ...turn.facts,
              values: reviewValues ?? turn.facts.values,
              candidates: appendProposals(turn.facts.candidates, [
                ...completed,
                ...checkpoint.pendingCandidates,
              ]),
            }),
          ...(review && {
            review: {
              fields: reviewFields,
              reasons: checkpoint.reviewReasons ?? [],
              fieldInstructions: plan.steps
                .filter((goal) =>
                  goal.fields.some((field) =>
                    reviewFields.some((key) => key === field),
                  ),
                )
                .map(({ fields, instructions }) => ({ fields, instructions })),
              remainingFields,
              uncoveredFields,
              modelCallsUsed: () => checkpoint.reviewModelCalls ?? 0,
              startModelCall: () =>
                serialize(() =>
                  save({
                    ...checkpoint,
                    reviewModelCalls: (checkpoint.reviewModelCalls ?? 0) + 1,
                  }),
                ),
              reserveRead: (limit) =>
                serialize(async () => {
                  const reads = checkpoint.reviewReads ?? 0;
                  if (reads >= limit) return false;
                  await save({ ...checkpoint, reviewReads: reads + 1 });
                  return true;
                }),
              recordReasons: (id, reasons) =>
                serialize(async () => {
                  const old = checkpoint.receipts.find(
                    (row) => row.id === id,
                  )?.status;
                  if (old) return old;
                  const remaining = new Set(remainingFields());
                  if (checkpoint.receipts.length === 500)
                    return reasons.map(() => 'candidate_limit');
                  const merged = new Map(
                    (checkpoint.reviewReasons ?? []).map((entry) => [
                      entry.field,
                      entry,
                    ]),
                  );
                  const statuses = reasons.map((entry) => {
                    if (!remaining.has(entry.field)) return 'field_not_empty';
                    merged.set(entry.field, entry);
                    return 'saved';
                  });
                  await save({
                    ...checkpoint,
                    reviewReasons: [...merged.values()],
                    receipts: [
                      ...checkpoint.receipts,
                      { id, status: statuses },
                    ],
                  });
                  return statuses;
                }),
            },
          }),
          proposeFacts: (id, proposals, statuses, fields) =>
            serialize(async () => {
              const receipt = checkpoint.receipts.find((row) => row.id === id);
              if (receipt?.feedback)
                return { statuses: receipt.status, feedback: receipt.feedback };
              const factsBefore = () =>
                input.projectFacts(
                  appendProposals(completed, checkpoint.pendingCandidates),
                );
              const result = [...statuses];
              const remaining = new Set(remainingFields());
              const writable = review
                ? proposals.filter(({ candidate, index }) => {
                    if (remaining.has(candidate.field)) return true;
                    result[index] = 'field_not_empty';
                    return false;
                  })
                : proposals;
              if (
                !review &&
                writable.some(
                  ({ candidate }) => !step.fields.includes(candidate.field),
                )
              ) {
                throw new Error('ANALYSIS_STEP_FIELD_NOT_ALLOWED');
              }
              const pendingCandidates = appendProposals(
                checkpoint.pendingCandidates,
                writable.map(({ candidate }) => candidate),
              );
              if (
                completed.length + pendingCandidates.length > 500 ||
                checkpoint.receipts.length === 500
              )
                return proposalResult(
                  result.map((status) =>
                    status === 'saved' ? 'candidate_limit' : status,
                  ),
                  fields,
                  proposals,
                  factsBefore(),
                );
              const proposedFacts = input.projectFacts(
                appendProposals(completed, pendingCandidates),
              );
              const proposedValues = proposedFacts.values;
              if (
                reviewValues &&
                turn.fields.some(
                  ({ key }) =>
                    reviewValues?.[key] !== null &&
                    JSON.stringify(reviewValues?.[key]) !==
                      JSON.stringify(proposedValues[key]),
                )
              )
                return proposalResult(
                  result.map((status) =>
                    status === 'saved' ? 'would_change_filled_field' : status,
                  ),
                  fields,
                  proposals,
                  factsBefore(),
                );
              const publication = proposalResult(
                result,
                fields,
                proposals,
                proposedFacts,
              );
              await save({
                ...checkpoint,
                pendingCandidates,
                receipts: [
                  ...checkpoint.receipts,
                  { id, status: result, feedback: publication.feedback },
                ],
              });
              if (review) reviewValues = proposedValues;
              return publication;
            }),
          reportDiscrepancy: (id, discrepancy) =>
            serialize(async () => {
              if (step.kind !== 'review')
                throw new Error('ANALYSIS_STEP_NOT_REVIEW');
              const previous = checkpoint.receipts.find((row) => row.id === id)
                ?.status[0];
              if (previous) return previous;
              if (
                checkpoint.discrepancies.length === 100 ||
                checkpoint.receipts.length === 500
              )
                return 'candidate_limit';
              const duplicate = checkpoint.discrepancies.some(
                (item) => JSON.stringify(item) === JSON.stringify(discrepancy),
              );
              await save({
                ...checkpoint,
                discrepancies: duplicate
                  ? checkpoint.discrepancies
                  : [...checkpoint.discrepancies, discrepancy],
                receipts: [...checkpoint.receipts, { id, status: ['saved'] }],
              });
              return 'saved';
            }),
        })
        .catch(async (error: unknown) => {
          if (
            !review ||
            (isAppError(error) && error.code === 'CONNECTION_REVOKED')
          )
            throw error;
          await turn.assertCurrent();
          return {
            summary:
              'Сверка прервалась. Сохранены проверенные сведения и принятые причины пропусков.',
            usage: { inputTokens: null, outputTokens: null },
            reviewLimit: undefined,
            errorCode:
              error instanceof LlmError ? error.code : 'ANALYSIS_STEP_FAILED',
          };
        });
      const candidates = appendProposals(
        completed,
        checkpoint.pendingCandidates,
      );
      const found = new Set(candidates.map(({ field }) => field));
      const reasons = checkpoint.reviewReasons ?? [];
      const missing = review
        ? remainingFields()
        : turn.fields
            .filter(
              ({ key }) =>
                step.fields.includes(key) &&
                !found.has(key) &&
                turn.facts.values[key] === null,
            )
            .map(({ key }) => key);
      const reviewOutcome = review
        ? {
            summary: result.summary,
            unreportedFields: uncoveredFields(),
            ...(result.reviewLimit && { limit: result.reviewLimit }),
            ...('errorCode' in result && { errorCode: result.errorCode }),
          }
        : undefined;
      if (reviewOutcome) setReviewFailure(step.key, reviewOutcome);
      await save(
        {
          ...checkpoint,
          ...(!('errorCode' in result) && addUsage(checkpoint, result.usage)),
          finished: failure
            ? checkpoint.finished
            : [
                ...checkpoint.finished,
                {
                  key: step.key,
                  summary: result.summary,
                  missingFields: missing,
                },
              ],
          receipts: [],
          pendingCandidates: [],
          ...(review && {
            reviewReasons: reasons.filter(({ field }) =>
              missing.includes(field),
            ),
          }),
          ...(reviewOutcome && { reviewOutcome }),
        },
        candidates,
      );
      if (failure) break;
    } catch (error) {
      const stepLimit =
        error instanceof LlmError && error.code === 'LLM_STEP_LIMIT';
      if (
        (!checkpoint.finished.length && !stepLimit) ||
        (isAppError(error) && error.code === 'CONNECTION_REVOKED')
      )
        throw error;
      await turn.assertCurrent();
      failure = {
        step: step.key,
        errorCode:
          error instanceof LlmError ? error.code : 'ANALYSIS_STEP_FAILED',
      };
      break;
    }
  }
  return {
    summary: checkpoint.finished
      .map(({ summary }) => summary)
      .join('\n')
      .slice(0, 4000),
    candidates: completed,
    usage: {
      inputTokens: checkpoint.inputTokens,
      outputTokens: checkpoint.outputTokens,
    },
    failure,
    steps: checkpoint.finished,
    reviewOutcome: checkpoint.reviewOutcome,
    reviewReasons: checkpoint.reviewOutcome
      ? (checkpoint.reviewReasons ?? [])
      : undefined,
    discrepancies:
      failure && !checkpoint.reviewOutcome ? [] : checkpoint.discrepancies,
  };
}
