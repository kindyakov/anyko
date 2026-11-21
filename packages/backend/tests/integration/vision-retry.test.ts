import { expect, test } from 'bun:test';
import { Buffer } from 'node:buffer';

import { z } from 'zod';

import { createDatabasePool } from '@anyko/database';

import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
import { completionStream } from '../support/completion-stream';

test('RouterAI DeepSeek transcription sends the image bytes and preserves the response budget', async () => {
  const pool = createDatabasePool(
    z.string().min(1).parse(process.env.TEST_DATABASE_URL),
  );
  const transcript = 'Дата выдачи: 14.09.2021\nКод подразделения: 041-508';
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAABv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AaP/Z';
  const imageUrls: string[] = [];
  let calls = 0;
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (_request: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls++;
        const body = z
          .object({
            stream: z.literal(true),
            stream_options: z.object({ include_usage: z.literal(true) }),
            reasoning: z.object({ effort: z.string() }).optional(),
            messages: z.array(
              z.object({
                role: z.string(),
                content: z.union([
                  z.string(),
                  z.array(
                    z.object({
                      type: z.string(),
                      image_url: z.object({ url: z.string() }).optional(),
                    }),
                  ),
                ]),
              }),
            ),
          })
          .parse(await new Response(init?.body).json());
        for (const { role, content } of body.messages) {
          if (role !== 'user' || typeof content === 'string') continue;
          for (const part of content) {
            if (part.type === 'image_url' && part.image_url)
              imageUrls.push(part.image_url.url);
          }
        }
        const reasoningDisabled = body.reasoning?.effort === 'none';
        return completionStream({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: '~deepseek/deepseek-v4-flash-latest',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: reasoningDisabled
                  ? JSON.stringify({ description: transcript })
                  : null,
              },
              finish_reason: reasoningDisabled ? 'stop' : 'length',
            },
          ],
          usage: {
            prompt_tokens: 200,
            completion_tokens: reasoningDisabled ? 35 : 4800,
          },
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  try {
    await agents.ready();
    const result = await agents.describe({
      connection: {
        id: 'routerai',
        baseURL: 'https://routerai.ru/api/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: '~deepseek/deepseek-v4-flash-latest',
      resource: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      bytes: Uint8Array.from(Buffer.from(jpegBase64, 'base64')),
      mediaType: 'image/jpeg',
      purpose: 'transcription',
      disableReasoning: true,
      signal: AbortSignal.timeout(15000),
    });
    expect(result.description).toBe(transcript);
    expect(imageUrls).toEqual([`data:image/jpeg;base64,${jpegBase64}`]);
    expect(calls).toBe(1);
  } finally {
    await agents.stop();
    await pool.end();
  }
}, 20000);

test('real Mastra OCR reports the stream idle error without retrying processing comments', async () => {
  const pool = createDatabasePool(
    z.string().min(1).parse(process.env.TEST_DATABASE_URL),
  );
  let calls = 0;
  let comments: ReturnType<typeof setInterval> | undefined;
  const encoder = new TextEncoder();
  const agents = createDocumentAgents({
    pool,
    timeoutMs: 75,
    fetch: Object.assign(
      () => {
        calls++;
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                comments = setInterval(() => {
                  controller.enqueue(encoder.encode(': PROCESSING\n\n'));
                }, 5);
              },
              cancel() {
                clearInterval(comments);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
        );
      },
      { preconnect: fetch.preconnect },
    ),
  });
  try {
    await agents.ready();
    const error = await agents
      .describe({
        connection: {
          id: 'fixture',
          baseURL: 'https://fixture.invalid/v1',
          apiKey: crypto.randomUUID(),
        },
        modelId: 'fixture',
        resource: crypto.randomUUID(),
        threadId: crypto.randomUUID(),
        bytes: new Uint8Array([1]),
        mediaType: 'image/jpeg',
        purpose: 'transcription',
        signal: AbortSignal.timeout(3000),
      })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ code: 'LLM_STREAM_IDLE' });
    expect(calls).toBe(1);
  } finally {
    clearInterval(comments);
    await agents.stop();
    await pool.end();
  }
});

test('real Mastra adapter retries a malformed OpenAI-compatible response', async () => {
  let calls = 0;
  const pool = createDatabasePool(
    z.string().min(1).parse(process.env.TEST_DATABASE_URL),
  );
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      () => {
        calls++;
        return Promise.resolve(
          completionStream({
            id: 'fixture',
            object: 'chat.completion',
            created: 1,
            model: 'fixture',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: calls === 1 ? 'not json' : '{"description":"Схема"}',
                },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
          }),
        );
      },
      { preconnect: fetch.preconnect },
    ),
  });
  try {
    await agents.ready();
    const result = await agents.describe({
      connection: {
        id: 'fixture',
        baseURL: 'https://fixture.invalid/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: 'fixture',
      resource: crypto.randomUUID(),
      threadId: crypto.randomUUID(),
      bytes: new Uint8Array([1]),
      mediaType: 'image/jpeg',
      signal: AbortSignal.timeout(10000),
    });
    expect(result.description).toBe('Схема');
    expect(calls).toBe(2);
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  } finally {
    await agents.stop();
    await pool.end();
  }
});
