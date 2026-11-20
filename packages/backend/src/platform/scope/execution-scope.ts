declare const executionScopeBrand: unique symbol;

/** Issued only by processing after reading the durable run, never from queue payload. */
export interface ExecutionScope {
  readonly [executionScopeBrand]: true;
  readonly workspaceId: string;
  readonly runId: string;
  readonly correlationId: string;
  readonly jobName: string;
}
