import { z } from 'zod';

const tokens = z.number().int().min(0).max(2_147_483_647);
const usageSchema = z.object({
  prompt_tokens: tokens.nullish(),
  completion_tokens: tokens.nullish(),
  prompt_tokens_details: z
    .object({ cached_tokens: tokens.nullish() })
    .nullish(),
  completion_tokens_details: z
    .object({ reasoning_tokens: tokens.nullish() })
    .nullish(),
});

const toolCall = z.object({
  index: z.number().optional(),
  id: z.string().optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});
const message = z.object({
  role: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(toolCall).nullish(),
  content: z
    .union([
      z.string(),
      z.array(
        z
          .object({ type: z.string(), text: z.string().optional() })
          .transform(({ type, text }) =>
            type === 'text' || type === 'output_text'
              ? { type, text }
              : { type },
          ),
      ),
    ])
    .nullish(),
});
const requestSchema = z.object({
  messages: z.array(message),
  tools: z
    .array(
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.json().optional(),
        }),
      }),
    )
    .optional(),
});
const traceRequestSchema = requestSchema.extend({
  max_tokens: tokens.optional(),
  reasoning: z.json().optional(),
  response_format: z.json().optional(),
});
const responseChoices = z.array(
  z.object({
    message: message.nullish(),
    delta: message.nullish(),
    finish_reason: z.string().nullish(),
  }),
);
const responseEnvelope = z.object({
  choices: z.unknown().optional(),
  usage: z.unknown().optional(),
});

function parseResponse(raw: unknown) {
  const parsed = responseEnvelope.safeParse(raw);
  return {
    choices: responseChoices.safeParse(parsed.data?.choices).data ?? [],
    usage: usageSchema.safeParse(parsed.data?.usage).data,
  };
}

interface ProviderResult {
  status: 'responded' | 'failed';
  output: string | null;
  errorCode: string | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}

/** One start/finish pair per transport call, including SDK retries. */
export type ProviderCallObserver = (
  input: string | null,
) => Promise<(result: ProviderResult) => Promise<void>>;

async function readResponse(response: Response) {
  const copy = response.clone();
  if (!copy.headers.get('content-type')?.includes('text/event-stream')) {
    return [parseResponse(await copy.json())];
  }
  // generate() also works with compatible providers that reply as an event stream.
  return (await copy.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) => line.startsWith('data:') && line.slice(5).trim() !== '[DONE]',
    )
    .flatMap((line) => {
      try {
        return [parseResponse(JSON.parse(line.slice(5)))];
      } catch {
        return [];
      }
    });
}

export async function readProviderRequest(
  request: Parameters<typeof fetch>[0],
  init?: RequestInit,
  diagnostic = false,
) {
  const raw: unknown =
    typeof init?.body === 'string'
      ? JSON.parse(init.body)
      : request instanceof Request
        ? await request.clone().json()
        : null;
  return (
    (diagnostic ? traceRequestSchema : requestSchema).safeParse(raw).data ??
    null
  );
}

export function observeProviderFetch(
  transport: typeof fetch,
  observe: ProviderCallObserver,
): typeof fetch {
  const observed: typeof fetch = Object.assign(
    async (...args: Parameters<typeof fetch>) => {
      const [request, init] = args;
      const input = await Promise.resolve()
        .then(async () => {
          const prompt = await readProviderRequest(request, init);
          return prompt && JSON.stringify(prompt);
        })
        .catch(() => null);
      const finish = await observe(input);
      const started = performance.now();
      let response: Response | undefined;
      try {
        response = await transport(...args);
        return response;
      } finally {
        const payloads = response
          ? await readResponse(response).catch(() => [])
          : [];
        const usage = payloads
          .flatMap((payload) => (payload.usage ? [payload.usage] : []))
          .at(-1);
        const choices = payloads.flatMap((payload) => payload.choices);
        const result: ProviderResult = {
          status: response?.ok && choices.length ? 'responded' : 'failed',
          // Error bodies and provider reasoning are outside the history contract.
          output:
            response?.ok && choices.length ? JSON.stringify(choices) : null,
          errorCode: !response
            ? 'TRANSPORT_ERROR'
            : !response.ok
              ? `HTTP_${String(response.status)}`
              : !choices.length
                ? 'RESPONSE_UNREADABLE'
                : null,
          durationMs: Math.round(performance.now() - started),
          inputTokens: usage?.prompt_tokens ?? null,
          outputTokens: usage?.completion_tokens ?? null,
          cachedInputTokens:
            usage?.prompt_tokens_details?.cached_tokens ?? null,
          reasoningTokens:
            usage?.completion_tokens_details?.reasoning_tokens ?? null,
        };
        try {
          await finish(result);
        } catch {
          // A failed history write must not replace the outcome of a dispatched call.
        }
      }
    },
    { preconnect: transport.preconnect },
  );
  return observed;
}
