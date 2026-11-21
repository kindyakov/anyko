import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';

import { createLocalModelTrace, type ModelTraceContext } from './local-trace';
import {
  observeProviderFetch,
  type ProviderCallObserver,
} from './provider-calls';
import {
  ProviderStreamIdleError,
  watchProviderStream,
} from './provider-stream';
import { createRouterContextLimits } from './router-context';

export type { ProviderCallObserver } from './provider-calls';
export type { ModelTraceContext } from './local-trace';
export type { ModelContextLimits } from './router-context';

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
  streamIdleTimeoutMs: z.number().int().positive().optional(),
});

export type ModelConnection = z.infer<typeof connectionSchema>;
export type ModelSelection = z.infer<typeof modelSchema>;
export type LlmErrorCode =
  | 'LLM_AUTH_FAILED'
  | 'LLM_RATE_LIMITED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_TIMEOUT'
  | 'LLM_STREAM_IDLE'
  | 'LLM_CANCELLED'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_COMPLETION_LIMIT'
  | 'LLM_REQUEST_REJECTED';

export class LlmError extends Error {
  constructor(public readonly code: LlmErrorCode) {
    super(code);
  }

  get diagnosticMessage(): string {
    return llmErrorMessages[this.code];
  }
}

const llmErrorMessages = {
  LLM_AUTH_FAILED: 'Провайдер модели отклонил авторизацию.',
  LLM_RATE_LIMITED: 'Провайдер модели ограничил частоту запросов.',
  LLM_UNAVAILABLE: 'Провайдер модели недоступен.',
  LLM_TIMEOUT: 'Провайдер модели не ответил за отведённое время.',
  LLM_STREAM_IDLE: 'Модель перестала передавать данные ответа.',
  LLM_CANCELLED: 'Запрос к модели отменён.',
  LLM_INVALID_RESPONSE: 'Ответ модели не соответствует ожидаемому формату.',
  LLM_COMPLETION_LIMIT: 'Ответ модели оборвался на предельном числе токенов.',
  LLM_REQUEST_REJECTED: 'Провайдер модели отклонил запрос.',
} satisfies Record<LlmErrorCode, string>;

/** No provider body, prompt or credential crosses the application error seam. */
export function llmError(error: unknown, signal?: AbortSignal): LlmError {
  if (error instanceof LlmError) return error;
  let cause = error;
  for (let depth = 0; cause instanceof Error && depth < 6; depth++) {
    if (cause instanceof ProviderStreamIdleError)
      return new LlmError('LLM_STREAM_IDLE');
    cause = cause.cause;
  }
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

export function createModelGateway(
  options: { fetch?: typeof fetch; traceDirectory?: string } = {},
) {
  return {
    trace(
      context: ModelTraceContext | undefined,
      model: string,
      connection: ModelConnection,
    ) {
      if (options.traceDirectory && context)
        return createLocalModelTrace(
          options.traceDirectory,
          context,
          model,
          connection,
        );
    },
    contextLimits: createRouterContextLimits(options.fetch ?? fetch),
    reasoningOptions(connection: ModelConnection, effort: 'none' | 'high') {
      return { [connection.id]: { reasoning: { effort } } };
    },
    model(
      connection: ModelConnection,
      selection: ModelSelection,
      observe?: ProviderCallObserver,
      trace?: ReturnType<typeof createLocalModelTrace>,
    ) {
      const parsedConnection = connectionSchema.safeParse(connection);
      const parsedModel = modelSchema.safeParse(selection);
      if (!parsedConnection.success || !parsedModel.success)
        throw new LlmError('LLM_REQUEST_REJECTED');
      const config = parsedConnection.data;
      const baseFetch = options.fetch ?? fetch;
      const idleTimeoutMs = parsedModel.data.streamIdleTimeoutMs;
      const transport = idleTimeoutMs
        ? watchProviderStream(baseFetch, idleTimeoutMs)
        : options.fetch;
      const observed = observe
        ? observeProviderFetch(transport ?? baseFetch, observe)
        : transport;
      const traced = trace ? trace.wrap(observed ?? baseFetch) : observed;
      return createOpenAICompatible({
        name: config.id,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        supportsStructuredOutputs: parsedModel.data.structuredOutput,
        ...(idleTimeoutMs && { includeUsage: true }),
        ...(traced ? { fetch: traced } : {}),
      }).chatModel(parsedModel.data.id);
    },
  };
}
