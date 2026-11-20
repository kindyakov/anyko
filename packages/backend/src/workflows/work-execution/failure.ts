import { LlmError } from '@anyko/llm';
import { diagnoseFailure, type Logger } from '@anyko/logger';

import type { WorkAttempt } from '../../modules/processing';
import { isAppError } from '../../platform/errors';

export function logWorkFailure(
  logger: Logger,
  run: WorkAttempt['run'],
  error: unknown,
  input: {
    code: string;
    message: string;
    operation: string;
    state: 'failed' | 'partial' | 'cancelled';
  },
) {
  const failure = diagnoseFailure(error, {
    code:
      error instanceof LlmError || isAppError(error) ? error.code : input.code,
    message:
      error instanceof LlmError ? error.diagnosticMessage : input.message,
    operation: input.operation,
  });
  const log =
    input.state === 'cancelled'
      ? logger.warn
      : isAppError(error) && error.kind !== 'unavailable'
        ? logger.info
        : logger.error;
  log({
    event: 'work_processing_failed',
    jobId: run.id,
    jobType: `work.${run.kind}`,
    attempt: run.attempts,
    correlationId: run.correlationId,
    errorCode: failure.code,
    failure,
    state: input.state,
  });
}
