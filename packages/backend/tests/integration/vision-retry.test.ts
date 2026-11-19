import { expect, test } from 'bun:test';

import { z } from 'zod';

import { createDatabasePool } from '@anyko/database';

import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';

test('RouterAI DeepSeek transcription preserves the response budget for document text', async () => {
  const pool = createDatabasePool(
    z.string().min(1).parse(process.env.TEST_DATABASE_URL),
  );
  const transcript = 'Дата выдачи: 14.09.2021\nКод подразделения: 041-508';
  let calls = 0;
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (_request: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls++;
        const body = z
          .object({
            reasoning: z.object({ effort: z.string() }).optional(),
          })
          .parse(await new Response(init?.body).json());
        const reasoningDisabled = body.reasoning?.effort === 'none';
        return Response.json({
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
      bytes: new Uint8Array([1]),
      mediaType: 'image/jpeg',
      purpose: 'transcription',
      signal: AbortSignal.timeout(15000),
    });
    expect(result.description).toBe(transcript);
    expect(calls).toBe(1);
  } finally {
    await agents.stop();
    await pool.end();
  }
}, 20000);

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
          Response.json({
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
