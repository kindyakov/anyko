import { LlmError } from '@anyko/llm';
import type { Logger } from '@anyko/logger';

interface Usage {
  inputTokens: number | null;
  outputTokens: number | null;
}
export function addUsage(left: Usage, right: Usage): Usage {
  return {
    inputTokens:
      left.inputTokens === null || right.inputTokens === null
        ? null
        : left.inputTokens + right.inputTokens,
    outputTokens:
      left.outputTokens === null || right.outputTokens === null
        ? null
        : left.outputTokens + right.outputTokens,
  };
}
export async function callModel<T extends { usage: Usage }>(input: {
  logger: Logger;
  callId: string;
  runId: string;
  correlationId: string;
  stage: string;
  provider: string;
  model: string;
  execute(): Promise<T>;
}): Promise<T> {
  const start = performance.now();
  const context = {
    event: 'model_call_completed',
    requestId: input.callId,
    jobId: input.runId,
    correlationId: input.correlationId,
    jobType: input.stage,
    provider: input.provider,
    model: input.model,
  };
  try {
    const result = await input.execute();
    input.logger.info({
      ...context,
      durationMs: Math.round(performance.now() - start),
      ...(result.usage.inputTokens === null
        ? {}
        : { inputTokens: result.usage.inputTokens }),
      ...(result.usage.outputTokens === null
        ? {}
        : { outputTokens: result.usage.outputTokens }),
    });
    return result;
  } catch (error) {
    input.logger.warn({
      ...context,
      durationMs: Math.round(performance.now() - start),
      errorCode: error instanceof LlmError ? error.code : 'MODEL_CALL_FAILED',
    });
    throw error;
  }
}
