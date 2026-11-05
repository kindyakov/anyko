import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';

const connectionSchema = z.object({
  id: z.string().regex(/^[\w-]{1,80}$/),
  baseURL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  }),
  apiKey: z.string().min(1).max(8192),
});

const modelSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[\w~./:-]+$/),
  images: z.boolean(),
  tools: z.boolean(),
  structuredOutput: z.boolean(),
});

export type ModelConnection = z.infer<typeof connectionSchema>;
export type ModelSelection = z.infer<typeof modelSchema>;
export type LlmErrorCode =
  | 'LLM_AUTH_FAILED'
  | 'LLM_RATE_LIMITED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_TIMEOUT'
  | 'LLM_CANCELLED'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_REQUEST_REJECTED';

export class LlmError extends Error {
  constructor(public readonly code: LlmErrorCode) {
    super(code);
  }
}

/** No provider body, prompt or credential crosses the application error seam. */
export function llmError(error: unknown, signal?: AbortSignal): LlmError {
  if (error instanceof LlmError) return error;
  if (signal?.aborted)
    return new LlmError(
      signal.reason instanceof DOMException &&
        signal.reason.name === 'TimeoutError'
        ? 'LLM_TIMEOUT'
        : 'LLM_CANCELLED',
    );
  const status = z.object({ statusCode: z.number() }).safeParse(error);
  if (status.success) {
    if ([401, 403].includes(status.data.statusCode))
      return new LlmError('LLM_AUTH_FAILED');
    if (status.data.statusCode === 429) return new LlmError('LLM_RATE_LIMITED');
    if (status.data.statusCode >= 500) return new LlmError('LLM_UNAVAILABLE');
    return new LlmError('LLM_REQUEST_REJECTED');
  }
  return new LlmError('LLM_INVALID_RESPONSE');
}

export function createModelGateway(options: { fetch?: typeof fetch } = {}) {
  return {
    model(connection: ModelConnection, selection: ModelSelection) {
      const parsedConnection = connectionSchema.safeParse(connection);
      const parsedModel = modelSchema.safeParse(selection);
      if (!parsedConnection.success || !parsedModel.success)
        throw new LlmError('LLM_REQUEST_REJECTED');
      const config = parsedConnection.data;
      return createOpenAICompatible({
        name: config.id,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        supportsStructuredOutputs: parsedModel.data.structuredOutput,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      }).chatModel(parsedModel.data.id);
    },
  };
}
