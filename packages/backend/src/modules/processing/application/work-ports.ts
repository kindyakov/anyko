import type { WorkView } from '@anyko/contracts';
import { candidateSchema } from '@anyko/contracts';
import { z } from 'zod';

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
  finish(
    run: WorkRunRecord,
    status: 'succeeded' | 'partial' | 'failed' | 'cancelled',
    errorCode?: string,
  ): Promise<void>;
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
  list(workspaceId: string, workId: string): Promise<WorkView['runs']>;
  delivery(): Promise<{
    id: string;
    workspaceId: string;
    runId: string;
    token: string;
  } | null>;
  delivered(id: string, token: string): Promise<void>;
  release(id: string, token: string): Promise<void>;
  reconcile(): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
  thread(workspaceId: string, workId: string, threadId: string): Promise<void>;
  threads(workspaceId: string, workId: string): Promise<string[]>;
  eraseThreads(workspaceId: string, workId: string): Promise<void>;
}
