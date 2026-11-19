import { z } from 'zod';

import { documentImageLimit } from '../../../platform/document-output';
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
        imageIndex: z
          .number()
          .int()
          .min(0)
          .max(documentImageLimit - 1)
          .optional(),
      }),
    )
    .default([]),
});
export const workRunSchema = z.object({
  id: z.uuid(),
  inputRevision: z
    .number()
    .int()
    .nullable()
    .transform((revision) => revision ?? undefined)
    .optional(),
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
          imageIndex: z
            .number()
            .int()
            .min(0)
            .max(documentImageLimit - 1)
            .optional(),
        }),
      )
      .max(documentImageLimit),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
export type StepOutput = z.infer<typeof stepOutputSchema>;

export interface WorkRunSnapshot {
  id: string;
  workspaceId: string;
  workId: string;
  kind: 'analysis' | 'generation' | 'chat';
  inputRevision: number;
  automaticUpload?: boolean;
  documentIds: string[];
  settingsRevision: number | null;
  generationId: string | null;
  correlationId: string;
}
export type AnalysisRecovery = Pick<
  WorkRunSnapshot,
  'documentIds' | 'inputRevision' | 'automaticUpload'
>;
export interface ClaimedWorkRun {
  snapshot: WorkRunSnapshot;
  attemptToken: string;
}

export interface WorkStepInput {
  stage: 'parsing' | 'vision' | 'extraction' | 'reconciliation' | 'generation';
  documentId?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
  errorCode?: string;
  usage?: { inputTokens: number | null; outputTokens: number | null };
  output?: StepOutput;
}

export interface WorkRunOutcome {
  status: 'succeeded' | 'partial' | 'failed' | 'cancelled';
  errorCode?: string;
}
export interface WorkProcessingStore {
  latestAnalysisRecovery(
    workspaceId: string,
    workId: string,
  ): Promise<AnalysisRecovery | null>;
  start(
    input: WorkRunSnapshot & {
      actorId: string;
      modelSnapshot: { vision: string; extraction: string };
    },
  ): Promise<void>;
  claim: (
    workspaceId: string,
    runId: string,
    attemptToken: string,
    leaseUntil: Date,
  ) => Promise<ClaimedWorkRun | null>;
  active(workspaceId: string, workId: string): Promise<boolean>;
  valid(run: ClaimedWorkRun): Promise<boolean>;
  fence(run: ClaimedWorkRun): Promise<void>;
  finish(run: ClaimedWorkRun, outcome: WorkRunOutcome): Promise<boolean>;
  step(run: ClaimedWorkRun, input: WorkStepInput): Promise<void>;
  cached(
    run: WorkRunSnapshot,
    documentId: string,
    stage: 'vision' | 'extraction',
    sourceDigest: string,
  ): Promise<StepOutput | null>;
  sourceVisuals(
    workspaceId: string,
    workId: string,
    documentId: string,
    sourceDigest: string,
  ): Promise<StepOutput['visuals']>;
  list(workspaceId: string, workId: string): Promise<WorkRuns>;
  cancel: (workspaceId: string, workId: string) => Promise<void>;
  erase: (workspaceId: string, workId: string) => Promise<void>;
  thread: (
    workspaceId: string,
    workId: string,
    threadId: string,
  ) => Promise<void>;
  threads: (workspaceId: string, workId: string) => Promise<string[]>;
  eraseThreads: (workspaceId: string, workId: string) => Promise<void>;
}
