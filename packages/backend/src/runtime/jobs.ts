import type {
  createJobProcessing,
  ExecutionScope,
} from '../modules/processing';
import type { JobRegistry } from '../platform/jobs';
import { documentOcrJob } from '../workflows/document-ocr/jobs';
import { workAnalysisJob } from '../workflows/work-analysis/jobs';
import { workGenerationJob } from '../workflows/work-generation/jobs';
import { workMaintenanceJob } from '../workflows/work-maintenance/jobs';

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
