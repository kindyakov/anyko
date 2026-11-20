import { z } from 'zod';

export interface ModelContextLimits {
  context: number;
  prompt: number;
  completion: number;
}

const catalogBase = 'https://routerai.ru/api/v1';
const tokenLimit = z.number().int().positive();
const catalog = z.object({
  data: z.object({
    endpoints: z.array(
      z.object({
        context_length: tokenLimit,
        max_prompt_tokens: tokenLimit.nullish().catch(null),
        max_completion_tokens: tokenLimit.nullish().catch(null),
      }),
    ),
  }),
});

export function createRouterContextLimits(transport: typeof fetch) {
  const cache = new Map<
    string,
    { limits: ModelContextLimits; expires: number }
  >();
  return async (
    connection: { id: string; baseURL: string },
    modelId: string,
    signal: AbortSignal,
  ): Promise<ModelContextLimits | null> => {
    if (
      connection.id !== 'routerai' ||
      connection.baseURL.replace(/\/$/, '') !== catalogBase ||
      !/^~?[\w-]+\/[\w.:-]+$/.test(modelId)
    )
      return null;

    const cached = cache.get(modelId);
    if (cached && cached.expires > Date.now()) return cached.limits;
    try {
      const path = modelId.split('/').map(encodeURIComponent).join('/');
      const response = await transport(
        `${catalogBase}/models/${path}/endpoints`,
        {
          redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
        },
      );
      if (!response.ok) return null;
      const { endpoints } = catalog.parse(await response.json()).data;
      if (!endpoints.length) return null;

      // The router can fall back to another endpoint for this model.
      const limits = endpoints.reduce<ModelContextLimits>(
        (current, endpoint) => ({
          context: Math.min(current.context, endpoint.context_length),
          prompt: Math.min(
            current.prompt,
            endpoint.max_prompt_tokens ?? endpoint.context_length,
          ),
          completion: Math.min(
            current.completion,
            endpoint.max_completion_tokens ?? endpoint.context_length,
          ),
        }),
        { context: Infinity, prompt: Infinity, completion: Infinity },
      );
      if (cache.size >= 128) cache.clear();
      cache.set(modelId, { limits, expires: Date.now() + 5 * 60 * 1000 });
      return limits;
    } catch {
      signal.throwIfAborted();
      return null;
    }
  };
}
