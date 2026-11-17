import type { JobEnvelope } from '../../../platform/jobs';
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
  read(workspaceId: string, runId: string): Promise<SavedJobRun | null>;
}
export function createJobProcessing(store: JobRunReader) {
  return {
    internal: {
      async scope(envelope: JobEnvelope, jobName: string) {
        const run = await store.read(envelope.workspaceId, envelope.runId);
        if (!run || run.status !== 'queued' || run.jobName !== jobName)
          return null;
        if (
          envelope.correlationId !== run.correlationId ||
          (envelope.attemptId !== undefined &&
            envelope.attemptId !== run.attemptToken)
        )
          return null;
        return issueExecutionScope(run);
      },
      read: (workspaceId: string, runId: string) =>
        store.read(workspaceId, runId),
    },
  };
}
