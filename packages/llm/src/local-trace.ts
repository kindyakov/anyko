import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { readProviderRequest } from './provider-calls';
import {
  captureProviderStream,
  isProviderStream,
  ProviderStreamIdleError,
} from './provider-stream';

export interface ModelTraceContext {
  correlationId: string | null;
  jobId: string;
  stage: 'ocr' | 'extraction' | 'reconciliation' | 'chat';
  documentId?: string;
}

function responseMetadata(body: string, streaming: boolean) {
  const chunks = streaming
    ? body
        .split(/\r?\n/u)
        .flatMap((line) =>
          line.startsWith('data:') ? [line.slice(5).trim()] : [],
        )
    : [body];
  const reasoning: string[] = [];
  let usage: Record<string, unknown> | null = null;
  let finishReason: string | null = null;
  const object = (value: unknown) =>
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  for (const chunk of chunks) {
    try {
      const event: unknown = JSON.parse(chunk);
      const message = object(event);
      usage = object(message?.usage) ?? usage;
      const choices: unknown = message?.choices;
      if (!Array.isArray(choices)) continue;
      for (const choice of choices as unknown[]) {
        const entry = object(choice);
        if (typeof entry?.finish_reason === 'string')
          finishReason = entry.finish_reason;
        const content = object(entry?.message ?? entry?.delta);
        const text = content?.reasoning_content ?? content?.reasoning;
        if (typeof text === 'string') reasoning.push(text);
      }
    } catch {
      // Keep the raw response even if it cannot be decoded.
    }
  }
  return {
    reasoning: reasoning.length ? reasoning.join('') : null,
    finishReason,
    usage: usage && {
      ...usage,
      reasoningTokens:
        object(usage.completion_tokens_details)?.reasoning_tokens ?? null,
    },
  };
}

export function createLocalModelTrace(
  directory: string,
  context: ModelTraceContext,
  model: string,
  connection: { id: string; baseURL: string; apiKey: string },
) {
  const safeId = /^[a-z0-9][a-z0-9_-]{0,127}$/iu;
  const group = [context.correlationId, context.jobId].find(
    (id) => id && safeId.test(id),
  );
  if (!group) return;
  const folder = join(directory, group);
  const document =
    context.documentId && safeId.test(context.documentId)
      ? context.documentId
      : 'work';
  const nonce = randomUUID().slice(0, 8);
  let attempt = 0;
  let last: { path: string; record: Record<string, unknown> } | undefined;
  const escapedKey = JSON.stringify(connection.apiKey).slice(1, -1);
  const redact = (value: string) =>
    value
      .replaceAll(escapedKey, '[redacted]')
      .replaceAll(connection.apiKey, '[redacted]');

  const save = async (path: string, record: Record<string, unknown>) => {
    try {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const serialized = JSON.stringify(
        record,
        (_key, value: unknown) => {
          if (typeof value === 'string') return redact(value);
          if (!value || typeof value !== 'object' || Array.isArray(value))
            return value;
          return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(
              ([key, entry]) => [redact(key), entry],
            ),
          );
        },
        2,
      );
      await writeFile(path, serialized, { mode: 0o600 });
    } catch {
      // A local trace is optional and cannot change the model outcome.
    }
  };
  return {
    wrap(transport: typeof fetch): typeof fetch {
      return Object.assign(
        async (...args: Parameters<typeof fetch>) => {
          const timestamp = new Date().toISOString();
          const attemptNumber = ++attempt;
          const path = join(
            folder,
            `${timestamp.replaceAll(':', '-')}-${context.stage}-${document}-${String(attemptNumber)}-${nonce}.json`,
          );
          const [request, init] = args;
          const prompt = await readProviderRequest(request, init, true).catch(
            () => null,
          );
          const recordResponse = async (
            response: Response | undefined,
            raw: string | null,
            error?: unknown,
          ) => {
            const metadata =
              raw === null
                ? { reasoning: null, finishReason: null, usage: null }
                : responseMetadata(
                    raw,
                    response?.headers
                      .get('content-type')
                      ?.includes('text/event-stream') ?? false,
                  );
            const record = {
              ...context,
              attempt: attemptNumber,
              timestamp,
              model,
              connection: {
                id: connection.id,
                origin: new URL(connection.baseURL).origin,
              },
              prompt,
              responseStatus: response?.status ?? null,
              rawResponse: raw,
              ...metadata,
              parse:
                error instanceof ProviderStreamIdleError
                  ? { status: 'rejected', reason: 'stream_idle' }
                  : !response?.ok || error !== undefined
                    ? {
                        status: 'rejected',
                        reason:
                          response && !response.ok
                            ? 'http_error'
                            : 'transport_error',
                      }
                    : metadata.finishReason === 'tool_calls'
                      ? { status: 'tool_calls' }
                      : null,
            };
            last = { path, record };
            await save(path, record);
          };
          let response: Response;
          try {
            response = await transport(...args);
          } catch (error) {
            await recordResponse(undefined, null, error);
            throw error;
          }
          if (response.body && isProviderStream(response))
            return captureProviderStream(response, (raw, error) =>
              recordResponse(response, raw, error),
            );
          const raw = await response
            .clone()
            .text()
            .catch(() => null);
          await recordResponse(response, raw);
          return response;
        },
        { preconnect: transport.preconnect },
      );
    },
    async parsed(result: unknown) {
      if (!last) return;
      last.record.parse = result;
      await save(last.path, last.record);
    },
    async failed() {
      if (!last || last.record.parse) return;
      last.record.parse = { status: 'rejected', reason: 'processing_failed' };
      await save(last.path, last.record);
    },
  };
}
