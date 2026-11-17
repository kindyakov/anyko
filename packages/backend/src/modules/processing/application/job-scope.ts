import type { ParsedJobEnvelope } from '../../../platform/jobs';
import { issueExecutionScope } from '../../../platform/scope/issue-execution';

export interface SavedJobRun {
  workspaceId: string;
  runId: string;
  correlationId: string;
  jobName: string;
  status: string;
  attemptToken: string | null;
}
export interface JobRunReader {
  read(
    workspaceId: string,
    runId: string,
    family: 'document' | 'work',
  ): Promise<SavedJobRun | null>;
}
export function createJobProcessing(store: JobRunReader) {
  return {
    internal: {
      async scope(envelope: ParsedJobEnvelope, jobName: string) {
        const run = await store.read(
          envelope.workspaceId,
          envelope.runId,
          jobName === 'document.ocr' ? 'document' : 'work',
        );
        if (!run || run.status !== 'queued' || run.jobName !== jobName)
          return null;
        if (
          envelope.format === 'current' &&
          (envelope.correlationId !== run.correlationId ||
            (envelope.attemptId !== undefined &&
              envelope.attemptId !== run.attemptToken))
        )
          return null;
        return issueExecutionScope(run);
      },
      read: (workspaceId: string, runId: string, family: 'document' | 'work') =>
        store.read(workspaceId, runId, family),
    },
  };
}
