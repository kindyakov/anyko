import { z } from 'zod';

export const workerQueues = ['ocr', 'llm', 'render', 'maintenance'] as const;
export type WorkerQueue = (typeof workerQueues)[number];

export function parseWorkerQueues(value?: string): WorkerQueue[] {
  if (value === undefined) return [...workerQueues];
  const selected = value.split(',').map((name) => name.trim());
  return [...new Set(z.array(z.enum(workerQueues)).min(1).parse(selected))];
}

const identity = {
  workspaceId: z.string().min(1),
  runId: z.uuid(),
};
const legacyEnvelope = z
  .object({ version: z.literal(1), ...identity })
  .strict();
const currentEnvelope = z
  .object({
    envelopeVersion: z.literal(1),
    version: z.number().int().positive(),
    ...identity,
    correlationId: z.uuid(),
    attemptId: z.uuid().optional(),
    payload: z.unknown(),
  })
  .strict();

export type JobEnvelope = z.infer<typeof currentEnvelope>;
export type ParsedJobEnvelope =
  | {
      format: 'legacy';
      version: number;
      workspaceId: string;
      runId: string;
      payload: unknown;
    }
  | ({ format: 'current' } & JobEnvelope);

/** The only business-envelope parser. Legacy delivery remains readable during rollout. */
export function parseJobEnvelope(
  input: unknown,
  version: number,
): ParsedJobEnvelope {
  const current = currentEnvelope.safeParse(input);
  if (current.success) {
    if (current.data.version !== version)
      throw new Error('UNKNOWN_JOB_VERSION');
    return { format: 'current', ...current.data };
  }
  const legacy = legacyEnvelope.safeParse(input);
  if (!legacy.success || version !== 1) throw new Error('INVALID_JOB_ENVELOPE');
  return { format: 'legacy', ...legacy.data, payload: {} };
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

/** Scope comes from the owner, independently of the untrusted envelope and payload. */
export function defineJob<Schema extends z.ZodType, Scope>(definition: {
  name: string;
  version: number;
  queue: WorkerQueue;
  payload: Schema;
  timeoutMs: number;
  retry: RetryPolicy;
  handler(
    scope: Scope,
    payload: z.output<Schema>,
    signal: AbortSignal,
  ): Promise<void>;
}) {
  if (
    !definition.name ||
    !Number.isInteger(definition.version) ||
    definition.version < 1 ||
    definition.timeoutMs <= 0 ||
    !Number.isInteger(definition.retry.attempts) ||
    definition.retry.attempts < 1 ||
    definition.retry.backoffMs < 0
  )
    throw new Error('INVALID_JOB_DEFINITION');
  return {
    ...definition,
    execute(
      scope: Scope,
      payload: unknown,
      signal: AbortSignal,
    ): Promise<void> {
      return definition.handler(
        scope,
        definition.payload.parse(payload),
        signal,
      );
    },
  };
}
