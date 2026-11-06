import { expect, test } from 'bun:test';

import { z } from 'zod';

import { createModelGateway, llmError } from './index';

test('ready SDK sends OpenAI-compatible request to the selected endpoint and model', async () => {
  const key = crypto.randomUUID();
  const requests: {
    path: string;
    authorization: string | null;
    model: string;
    prompt: unknown;
  }[] = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const payload: unknown = await request.json();
      const body = z
        .object({ model: z.string(), messages: z.array(z.unknown()) })
        .parse(payload);
      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        model: body.model,
        prompt: body.messages,
      });
      return Response.json({
        id: 'fixture',
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"value":"verified"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
      });
    },
  });
  try {
    const gateway = createModelGateway();
    const client = gateway.model(
      {
        id: 'fixture',
        baseURL: `http://127.0.0.1:${String(server.port)}/api/v1`,
        apiKey: key,
      },
      {
        id: 'fixture/flash',
        images: true,
        tools: true,
        structuredOutput: true,
      },
    );
    const result = await client.doGenerate({
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'synthetic document' }],
        },
      ],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.path).toBe('/api/v1/chat/completions');
    expect(requests[0]?.authorization).toBe(`Bearer ${key}`);
    expect(requests[0]?.model).toBe('fixture/flash');
    expect(result.content).toContainEqual({
      type: 'text',
      text: '{"value":"verified"}',
    });
  } finally {
    await server.stop(true);
  }
});

test('provider errors are classified without copying credential or response payload', () => {
  const secret = crypto.randomUUID();
  const error = llmError({
    statusCode: 401,
    responseBody: secret,
    requestBodyValues: { apiKey: secret },
  });
  expect(error.code).toBe('LLM_AUTH_FAILED');
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(llmError({ statusCode: 429 }).code).toBe('LLM_RATE_LIMITED');
  const timeout = new AbortController();
  timeout.abort(new DOMException('deadline', 'TimeoutError'));
  expect(llmError(new Error(), timeout.signal).code).toBe('LLM_TIMEOUT');
});

test('credentials and unsafe endpoint schemes are rejected before a network request', () => {
  const gateway = createModelGateway();
  expect(() =>
    gateway.model(
      {
        id: 'test',
        baseURL: 'http://example.com/v1',
        apiKey: crypto.randomUUID(),
      },
      { id: 'flash', images: false, tools: false, structuredOutput: true },
    ),
  ).toThrow('LLM_REQUEST_REJECTED');
});
