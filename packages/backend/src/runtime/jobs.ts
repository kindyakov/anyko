import type {
  createJobProcessing,
  ExecutionScope,
} from '../modules/processing';
import type { ParsedJobEnvelope, RunJob, ScheduledJob } from '../platform/jobs';
import { documentOcrJob } from '../workflows/document-ocr/jobs';
import { workAnalysisJob } from '../workflows/work-analysis/jobs';
import { workGenerationJob } from '../workflows/work-generation/jobs';
import { workMaintenanceJob } from '../workflows/work-maintenance/jobs';

export interface JobRegistry {
  definitions: readonly (RunJob | ScheduledJob)[];
  schedules: readonly { name: string; everyMs: number }[];
  scope(
    envelope: ParsedJobEnvelope,
    name: string,
  ): Promise<ExecutionScope | null>;
}
export function createJobRegistry(input: {
  processing: ReturnType<typeof createJobProcessing>;
  ocr(scope: ExecutionScope, signal: AbortSignal): Promise<void>;
  execute(scope: ExecutionScope, signal: AbortSignal): Promise<void>;
  maintain(): Promise<void>;
  ocrTimeoutMs: number;
}): JobRegistry {
  return {
    definitions: [
      documentOcrJob(input.ocr, input.ocrTimeoutMs),
      workAnalysisJob(input.execute),
      workGenerationJob(input.execute),
      workMaintenanceJob(input.maintain),
    ],
    schedules: [{ name: 'work.maintenance', everyMs: 1000 }],
    scope: input.processing.internal.scope,
  };
}
