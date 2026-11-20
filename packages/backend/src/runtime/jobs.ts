import {
  type createIdempotencyMaintenance,
  idempotencyCleanupJob,
} from '../modules/idempotency';
import type {
  createJobProcessing,
  ExecutionScope,
} from '../modules/processing';
import type { JobRegistry, RunPolicy } from '../platform/jobs';
import { documentMaintenanceJob } from '../workflows/document-maintenance/jobs';
import { documentOcrJob } from '../workflows/document-ocr/jobs';
import { workAnalysisJob } from '../workflows/work-analysis/jobs';
import { workChatJob } from '../workflows/work-chat/jobs';
import { workGenerationJob } from '../workflows/work-generation/jobs';
import { workMaintenanceJob } from '../workflows/work-maintenance/jobs';

export function createJobRegistry(input: {
  processing: ReturnType<typeof createJobProcessing>;
  ocr: Parameters<typeof documentOcrJob>[0];
  execute: (
    scope: ExecutionScope,
    signal: AbortSignal,
    connection: RunPolicy['connection'],
  ) => Promise<void>;
  maintain: () => Promise<void>;
  documents: Parameters<typeof documentMaintenanceJob>[0];
  idempotency: ReturnType<typeof createIdempotencyMaintenance>;
}): JobRegistry {
  return {
    definitions: [
      documentOcrJob(input.ocr),
      workAnalysisJob(input.execute),
      workChatJob(input.execute),
      workGenerationJob(input.execute),
      workMaintenanceJob(input.maintain),
      documentMaintenanceJob(input.documents),
      idempotencyCleanupJob(input.idempotency),
    ],
    schedules: [
      { name: 'work.maintenance', everyMs: 1000 },
      { name: 'document.maintenance', everyMs: 1000 },
      { name: 'idempotency.cleanup', everyMs: 60000 },
    ],
    scope: (envelope, name) => input.processing.internal.scope(envelope, name),
  };
}
