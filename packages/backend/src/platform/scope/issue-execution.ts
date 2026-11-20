import type { ExecutionScope } from './execution-scope';

/** Only processing may call this constructor after checking durable run identity. */
export function issueExecutionScope(input: {
  workspaceId: string;
  runId: string;
  correlationId: string;
  jobName: string;
}): ExecutionScope {
  // The opaque brand denotes processing provenance, enforced by dependency-cruiser.
  return Object.freeze({ ...input }) as ExecutionScope;
}
