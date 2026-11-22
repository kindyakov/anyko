import { ZodError } from 'zod';

import {
  debtSourceChecks,
  type FactSourceText,
} from '../../../profiles/bfl/automatic-value';
import type { FieldKey } from '../../../profiles/bfl/fields';
import { usesBankObligations } from '../../../profiles/bfl/reconcile-obligations';
import { combineCandidates } from '../domain/candidates';
import { mergeCandidates } from '../domain/values';
import type { WorkFacts } from '../schemas';

export interface RunProposals {
  fields: readonly FieldKey[];
  excludedFields?: ReadonlySet<FieldKey> | undefined;
  confirmed: boolean;
  preserveExisting?: boolean;
  candidates: WorkFacts['candidates'];
  contextCandidates?: WorkFacts['candidates'];
  passportIds?: ReadonlySet<string>;
  sourceTexts?: readonly FactSourceText[];
}

export function projectRunFacts(
  existing: WorkFacts,
  {
    candidates,
    contextCandidates,
    fields,
    excludedFields,
    confirmed,
    preserveExisting,
    passportIds,
    sourceTexts,
  }: RunProposals,
) {
  if (excludedFields?.size) {
    candidates = candidates.filter(({ field }) => !excludedFields.has(field));
    contextCandidates = contextCandidates?.filter(
      ({ field }) => !excludedFields.has(field),
    );
  }
  let selected = preserveExisting
    ? existing.candidates
    : combineCandidates(candidates);
  let extractionAccepted = !preserveExisting;
  let contextAccepted = false;
  try {
    selected = combineCandidates(candidates, existing.candidates);
    extractionAccepted = true;
    if (contextCandidates !== undefined) {
      selected = combineCandidates(selected, contextCandidates);
      contextAccepted = true;
    }
  } catch (error) {
    if (
      !(error instanceof ZodError) ||
      error.issues.length !== 1 ||
      error.issues[0]?.code !== 'too_big' ||
      error.issues[0].origin !== 'array' ||
      error.issues[0].path.length !== 0
    )
      throw error;
    // При выходе за бюджет остаётся последняя принятая группа кандидатов.
  }

  const sourceChecks = sourceTexts?.length
    ? debtSourceChecks(sourceTexts)
    : undefined;
  const next = mergeCandidates(
    existing,
    selected,
    confirmed,
    preserveExisting,
    excludedFields,
    passportIds,
    sourceChecks,
    sourceTexts,
  );
  if (!contextAccepted) {
    // Необязательная стадия не стирает известные значения без новых кандидатов.
    for (const field of fields) {
      const saved = existing.values[field];
      const stale =
        usesBankObligations(field, [saved]) &&
        Array.isArray(saved) &&
        saved.some((row) => sourceChecks?.hasNewerBalance(row));
      if (!stale && !selected.some((candidate) => candidate.field === field))
        next.values[field] = saved;
    }
  }
  return {
    next,
    extractionAccepted,
    contextAccepted,
    extraction: candidates,
    context: contextCandidates,
  };
}
