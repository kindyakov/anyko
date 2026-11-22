import { z } from 'zod';

export interface ModelContextLimits {
  context: number;
  prompt: number;
  completion: number | null;
}

const catalogBase = 'https://routerai.ru/api/v1';
const tokenLimit = z.number().int().positive().nullish().catch(null);
const metadata = z.object({
  context_length: tokenLimit,
  context_window: tokenLimit,
  max_prompt_tokens: tokenLimit,
  max_completion_tokens: tokenLimit,
  max_output_tokens: tokenLimit,
});
const record = metadata.extend({
  top_provider: metadata.nullish().catch(null),
});
const details = z.union([z.object({ data: record }), record]);
const catalog = z.object({
  data: z.object({
    endpoints: z.array(metadata),
  }),
});

function limitsFrom(
  item: z.infer<typeof metadata>,
  provider?: z.infer<typeof metadata> | null,
): ModelContextLimits | null {
  const context =
    item.context_length ??
    item.context_window ??
    provider?.context_length ??
    provider?.context_window;
  const prompt = item.max_prompt_tokens ?? provider?.max_prompt_tokens;
  const completion =
    item.max_completion_tokens ??
    item.max_output_tokens ??
    provider?.max_completion_tokens ??
    provider?.max_output_tokens ??
    null;
  if (context == null && prompt == null && completion == null) return null;
  return {
    context: context ?? 16384,
    prompt: prompt ?? context ?? 12288,
    completion,
  };
}

async function lookup(
  transport: typeof fetch,
  base: string,
  modelId: string,
  key: string,
  signal: AbortSignal,
) {
  const qualified = /^~?[\w-]+\/[\w.:-]+$/u.test(modelId);
  if (base === catalogBase && qualified) {
    const path = modelId.split('/').map(encodeURIComponent).join('/');
    const response = await transport(`${base}/models/${path}/endpoints`, {
      redirect: 'error',
      signal,
    });
    if (!response.ok) return null;
    const { endpoints } = catalog.parse(await response.json()).data;
    let limits: ModelContextLimits | null = null;
    for (const endpoint of endpoints) {
      const next = limitsFrom(endpoint);
      if (!next) continue;
      // The router can fall back to another endpoint for the same model.
      limits = limits
        ? {
            context: Math.min(limits.context, next.context),
            prompt: Math.min(limits.prompt, next.prompt),
            completion:
              next.completion === null
                ? limits.completion
                : Math.min(limits.completion ?? Infinity, next.completion),
          }
        : next;
    }
    return limits;
  }
  const response = await transport(
    `${base}/models/${encodeURIComponent(modelId)}`,
    {
      redirect: 'error',
      headers: { authorization: `Bearer ${key}` },
      signal,
    },
  );
  if (!response.ok) return null;
  const payload = details.parse(await response.json());
  const item = 'data' in payload ? payload.data : payload;
  return limitsFrom(item, item.top_provider);
}

export function createModelContextLimits(transport: typeof fetch) {
  const cache = new Map<
    string,
    { limits: ModelContextLimits | null; refresh: number; expires: number }
  >();
  return async (
    connection: { baseURL: string; apiKey: string },
    modelId: string,
    signal: AbortSignal,
  ): Promise<ModelContextLimits | null> => {
    if (!/^~?[\w][\w./:-]{0,199}$/u.test(modelId)) return null;
    signal.throwIfAborted();
    const base = connection.baseURL.replace(/\/+$/u, '');
    const cacheKey = JSON.stringify([
      base,
      modelId,
      Bun.hash(connection.apiKey).toString(),
    ]);
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.refresh > now) return cached.limits;
    let published;
    try {
      published = await lookup(
        transport,
        base,
        modelId,
        connection.apiKey,
        AbortSignal.any([signal, AbortSignal.timeout(2000)]),
      );
    } catch {
      signal.throwIfAborted();
    }
    signal.throwIfAborted();
    const current = cache.get(cacheKey) ?? cached;
    const fallback = current && current.expires > now ? current.limits : null;
    if (cache.size >= 128 && !cache.has(cacheKey)) cache.clear();
    if (published) {
      cache.set(cacheKey, {
        limits: published,
        refresh: now + 300000,
        expires: now + 3600000,
      });
      return published;
    }
    cache.set(cacheKey, {
      limits: fallback,
      refresh: now + 30000,
      expires: current?.expires ?? now,
    });
    return fallback;
  };
}
