import { z } from 'zod';

import type { Logger } from '@anyko/logger';

import type { Clock } from '../clock';
import type { ExecutionScope } from '../scope/execution-scope';

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
/** One boundary for business envelopes; scheduled jobs carry no workspace/run authority. */
export function parseJobEnvelope(
  input: unknown,
  version: number,
  kind: 'scheduled',
): z.infer<typeof scheduledEnvelope>;
export function parseJobEnvelope(
  input: unknown,
  version: number,
  kind?: 'run',
): JobEnvelope;
export function parseJobEnvelope(
  input: unknown,
  version: number,
  kind: 'run' | 'scheduled' = 'run',
): JobEnvelope | z.infer<typeof scheduledEnvelope> {
  if (kind === 'scheduled') {
    const parsed = scheduledEnvelope.parse(input);
    if (parsed.version !== version) throw new Error('UNKNOWN_JOB_VERSION');
    return parsed;
  }
  const parsed = currentEnvelope.parse(input);
  if (parsed.version !== version) throw new Error('UNKNOWN_JOB_VERSION');
  return parsed;
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

export interface SystemJobContext {
  readonly clock: Clock;
  readonly logger: Logger;
  readonly signal: AbortSignal;
  readonly correlationId: string;
}
interface CommonDefinition<Schema extends z.ZodType> {
  name: string;
  version: number;
  payload: Schema;
  timeoutMs: number;
  retry: RetryPolicy;
}
export interface RunPolicy {
  connection: 'required' | 'none';
  maxRunAttempts: number | null;
  redeliverQueued: boolean;
}
interface RunDefinition<Schema extends z.ZodType>
  extends CommonDefinition<Schema>, RunPolicy {
  kind: 'run';
  queue: WorkerQueue;
  handler(
    scope: ExecutionScope,
    payload: z.output<Schema>,
    signal: AbortSignal,
  ): Promise<void>;
}
interface ScheduledDefinition<
  Schema extends z.ZodType,
> extends CommonDefinition<Schema> {
  kind: 'scheduled';
  queue: 'maintenance';
  handler(
    context: SystemJobContext,
    payload: z.output<Schema>,
    signal: AbortSignal,
  ): Promise<void>;
}
export interface RunJob extends RunPolicy {
  kind: 'run';
  name: string;
  version: number;
  queue: WorkerQueue;
  timeoutMs: number;
  retry: RetryPolicy;
  execute(
    scope: ExecutionScope,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<void>;
}
export interface ScheduledJob {
  kind: 'scheduled';
  name: string;
  version: number;
  queue: 'maintenance';
  timeoutMs: number;
  retry: RetryPolicy;
  execute(
    context: SystemJobContext,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<void>;
}
export function defineJob<Schema extends z.ZodType>(
  definition: RunDefinition<Schema>,
): RunJob;
export function defineJob<Schema extends z.ZodType>(
  definition: ScheduledDefinition<Schema>,
): ScheduledJob;
export function defineJob<Schema extends z.ZodType>(
  definition: RunDefinition<Schema> | ScheduledDefinition<Schema>,
): RunJob | ScheduledJob {
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
  if (definition.kind === 'run')
    return {
      ...definition,
      execute: (scope: ExecutionScope, payload: unknown, signal: AbortSignal) =>
        definition.handler(scope, definition.payload.parse(payload), signal),
    };
  return {
    ...definition,
    execute: (
      context: SystemJobContext,
      payload: unknown,
      signal: AbortSignal,
    ) => definition.handler(context, definition.payload.parse(payload), signal),
  };
}
const scheduledEnvelope = z
  .object({
    envelopeVersion: z.literal(1),
    version: z.number().int().positive(),
    correlationId: z.uuid(),
    payload: z.unknown(),
  })
  .strict();
export interface JobRegistry {
  definitions: readonly (RunJob | ScheduledJob)[];
  schedules: readonly { name: string; everyMs: number }[];
  scope(envelope: JobEnvelope, name: string): Promise<ExecutionScope | null>;
}
export interface JobDelivery {
  id: string;
  workspaceId: string;
  runId: string;
  token: string;
}
export interface DeliveryPort {
  reserve(): Promise<JobDelivery | null>;
  describe(item: Pick<JobDelivery, 'workspaceId' | 'runId'>): Promise<{
    jobName: string;
    correlationId: string;
  } | null>;
  delivered(id: string, token: string): Promise<void>;
  release(id: string, token: string): Promise<void>;
}
export interface JobRuntime {
  registry: JobRegistry;
  delivery: DeliveryPort;
  reconcile(): Promise<void>;
  clock: Clock;
  newId(): string;
  logger: Logger;
  redisUrl: string;
  shutdownTimeoutMs: number;
  track(handle: { stop(): Promise<void> }): void;
}
