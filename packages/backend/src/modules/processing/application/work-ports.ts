import { z } from 'zod';

import { candidateSchema } from '../../../profiles/bfl/candidate';

const workStepSchema = z.object({
  id: z.uuid(),
  stage: z.enum([
    'parsing',
    'vision',
    'extraction',
    'reconciliation',
    'generation',
  ]),
  documentId: z.uuid().nullable(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped']),
  errorCode: z.string().nullable(),
  visuals: z
    .array(
      z.object({
        path: z.string(),
        description: z.string(),
        imageIndex: z.number().int().min(0).max(31).optional(),
      }),
    )
    .default([]),
});
export const workRunSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['analysis', 'generation']),
  status: z.enum([
    'queued',
    'running',
    'succeeded',
    'partial',
    'failed',
    'cancelled',
  ]),
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
  steps: z.array(workStepSchema),
});
export type WorkRuns = z.infer<typeof workRunSchema>[];

export const stepOutputSchema = z
  .object({
    version: z.literal(1),
    sourceDigest: z.string().default(''),
    visuals: z
      .array(
        z.object({
          path: z.string(),
          description: z.string().max(12000),
          imageIndex: z.number().int().min(0).max(31).optional(),
        }),
      )
      .max(32),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
type StepOutput = z.infer<typeof stepOutputSchema>;

export interface WorkRunRecord {
  id: string;
  workspaceId: string;
  workId: string;
  kind: 'analysis' | 'generation';
  inputRevision: number;
  documentIds: string[];
  settingsRevision: number | null;
  generationId: string | null;
  correlationId: string;
  attemptToken: string | null;
}
export interface WorkProcessingStore {
  start(
    input: WorkRunRecord & {
      actorId: string;
      modelSnapshot: { vision: string; extraction: string };
    },
  ): Promise<void>;
  claim(workspaceId: string, runId: string): Promise<WorkRunRecord | null>;
  active(workspaceId: string, workId: string): Promise<boolean>;
  valid(run: WorkRunRecord): Promise<boolean>;
  fence(run: WorkRunRecord): Promise<void>;
  finish(
    run: WorkRunRecord,
    status: 'succeeded' | 'partial' | 'failed' | 'cancelled',
    errorCode?: string,
  ): Promise<boolean>;
  step(
    run: WorkRunRecord,
    input: {
      stage:
        'parsing' | 'vision' | 'extraction' | 'reconciliation' | 'generation';
      documentId?: string;
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
      errorCode?: string;
      usage?: { inputTokens: number | null; outputTokens: number | null };
      output?: StepOutput;
    },
  ): Promise<void>;
  cached(
    run: WorkRunRecord,
    documentId: string,
    stage: 'vision' | 'extraction',
    sourceDigest: string,
  ): Promise<StepOutput | null>;
  list(workspaceId: string, workId: string): Promise<WorkRuns>;
  reconcile(): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
  thread(workspaceId: string, workId: string, threadId: string): Promise<void>;
  threads(workspaceId: string, workId: string): Promise<string[]>;
  eraseThreads(workspaceId: string, workId: string): Promise<void>;
}
