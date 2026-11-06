import { setTimeout as delay } from 'node:timers/promises';

import { z } from 'zod';

import { llmError } from '@anyko/llm';

function invalidResponse(error: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (error instanceof z.ZodError) return true;
  const parsed = z
    .object({
      name: z.string().optional(),
      id: z.string().optional(),
      cause: z.unknown().optional(),
    })
    .safeParse(error);
  return (
    parsed.success &&
    (parsed.data.id === 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED' ||
      [
        'AI_NoObjectGeneratedError',
        'AI_JSONParseError',
        'AI_TypeValidationError',
      ].includes(parsed.data.name ?? '') ||
      (parsed.data.cause !== undefined &&
        invalidResponse(parsed.data.cause, depth + 1)))
  );
}

/** Response validation retries share one deadline and never repeat arbitrary programming errors. */
export async function retryVisionResponse<T>(
  signal: AbortSignal,
  execute: () => Promise<T>,
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void> = async (
    milliseconds,
    current,
  ) => {
    await delay(milliseconds, undefined, { signal: current });
  },
): Promise<T> {
  try {
    for (let attempt = 1; ; attempt++) {
      signal.throwIfAborted();
      try {
        return await execute();
      } catch (error) {
        signal.throwIfAborted();
        if (attempt >= 3 || !invalidResponse(error)) throw error;
        await wait(attempt * 1000, signal);
      }
    }
  } catch (error) {
    throw llmError(error, signal);
  }
}
