import { factsSchema, type WorkFacts } from '../schemas';

export function candidatesForContext(
  raw: WorkFacts['candidates'],
  previous: WorkFacts['candidates'],
  documentIds: readonly string[],
  readableDocumentIds: readonly string[],
) {
  return combineCandidates(
    raw,
    previous.filter(
      (candidate) =>
        candidate.origin !== 'context' &&
        candidate.origin !== 'inference' &&
        candidate.evidence.every(({ documentId }) =>
          documentIds.includes(documentId),
        ) &&
        candidate.evidence.some(
          ({ documentId }) => !readableDocumentIds.includes(documentId),
        ),
    ),
  );
}

export function candidateIdentity(candidate: WorkFacts['candidates'][number]) {
  return JSON.stringify({
    field: candidate.field,
    value: candidate.value,
    evidence: candidate.evidence,
    ...(candidate.origin === 'inference' && { origin: candidate.origin }),
    ...(candidate.courtSources && { court: candidate.courtSources.contactUrl }),
  });
}

/** Preserve every document proposal: context suggestions cannot erase a conflict. */
export function combineCandidates(
  ...groups: WorkFacts['candidates'][]
): WorkFacts['candidates'] {
  const unique = new Map<string, WorkFacts['candidates'][number]>();
  for (const candidate of groups.flat()) {
    const key = candidateIdentity(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return factsSchema.shape.candidates.parse([...unique.values()]);
}
