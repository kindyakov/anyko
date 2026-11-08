import { z } from 'zod';

import type {
  AgentSession,
  AgentSessionContext,
  WorkFacts,
} from '@anyko/contracts';
import { candidateSchema } from '@anyko/contracts';

export const reconciliationSchema = z
  .object({
    summary: z.string().min(1).max(4000),
    candidates: z.array(candidateSchema).max(100),
  })
  .strict();
type Reconciliation = z.infer<typeof reconciliationSchema>;
export interface AgentSessionStore {
  get(workspaceId: string, workId: string): Promise<AgentSession | null>;
  ensure(workspaceId: string, workId: string): Promise<AgentSession>;
  accept(input: {
    workspaceId: string;
    workId: string;
    sessionId: string;
    expectedRevision: number;
    runId: string;
    threadId: string;
    context: AgentSessionContext;
    output: Reconciliation;
  }): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}

/** Preserve every document proposal: context suggestions cannot erase a conflict. */
export function combineCandidates(
  ...groups: WorkFacts['candidates'][]
): WorkFacts['candidates'] {
  const unique = new Map<string, WorkFacts['candidates'][number]>();
  for (const candidate of groups.flat()) {
    const content = {
      field: candidate.field,
      value: candidate.value,
      evidence: candidate.evidence,
    };
    const key = JSON.stringify(content);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return z
    .array(candidateSchema)
    .max(500)
    .parse([...unique.values()]);
}

/** Optional context additions must not roll back valid document extraction. */
export function selectSessionCandidates(
  raw: WorkFacts['candidates'],
  previous: WorkFacts['candidates'],
  proposed: WorkFacts['candidates'],
) {
  let base = combineCandidates(raw);
  try {
    base = combineCandidates(base, previous);
  } catch {
    return { candidates: base, contextAccepted: false };
  }
  try {
    return {
      candidates: combineCandidates(base, proposed),
      contextAccepted: true,
    };
  } catch {
    return { candidates: base, contextAccepted: false };
  }
}
