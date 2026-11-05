import { expect, test } from 'bun:test';
import { z } from 'zod';
import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
test('real Mastra adapter retries a malformed OpenAI-compatible response', async () => {
  let calls = 0;
  const agents = createDocumentAgents({
    databaseUrl: z.string().min(1).parse(process.env.TEST_DATABASE_URL),
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
  }
});
