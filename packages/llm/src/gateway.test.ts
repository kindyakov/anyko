import { expect, test } from 'bun:test';

import { z } from 'zod';

import {
  observeProviderFetch,
  type ProviderCallObserver,
} from './provider-calls';

import { createModelGateway, llmError } from './index';

test('the gateway addresses explicit reasoning options to the selected connection', () => {
  const gateway = createModelGateway();
  const connection = {
    id: 'team-router',
    baseURL: 'https://routerai.ru/api/v1',
    apiKey: 'fixture',
  };
  expect(gateway.reasoningOptions(connection, 'none')).toEqual({
    'team-router': { reasoning: { effort: 'none' } },
  });
  expect(gateway.reasoningOptions(connection, 'high')).toEqual({
    'team-router': { reasoning: { effort: 'high' } },
  });
});

test('RouterAI context lookup uses the selected model and the smallest published provider limits', async () => {
  const requests: { url: string; authorization: string | null }[] = [];
  const gateway = createModelGateway({
    fetch: Object.assign(
      (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        requests.push({
          url: request.url,
          authorization: request.headers.get('authorization'),
        });
        const payload = {
          data: {
            endpoints: [
              { context_length: 262144, max_completion_tokens: 131072 },
              {
                context_length: 131072,
                max_prompt_tokens: 120000,
                max_completion_tokens: 48000,
              },
            ],
          },
        };
        return Promise.resolve(Response.json(payload));
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const connection = {
    id: 'routerai',
    baseURL: 'https://routerai.ru/api/v1',
    apiKey: crypto.randomUUID(),
  };
  const signal = new AbortController().signal;
  expect(
    await gateway.contextLimits(connection, 'example/small', signal),
  ).toEqual({ context: 131072, prompt: 120000, completion: 48000 });
  await gateway.contextLimits(connection, 'example/small', signal);
  expect(
    await gateway.contextLimits(connection, '~example/large', signal),
  ).toEqual({ context: 131072, prompt: 120000, completion: 48000 });
  expect(
    await gateway.contextLimits(
      { ...connection, baseURL: 'https://fixture.invalid/v1' },
      'example/small',
      signal,
    ),
  ).toBeNull();
  expect(requests).toEqual([
    {
      url: 'https://routerai.ru/api/v1/models/example/small/endpoints',
      authorization: null,
    },
    {
      url: 'https://routerai.ru/api/v1/models/~example/large/endpoints',
      authorization: null,
    },
    {
      url: 'https://fixture.invalid/v1/models/example%2Fsmall',
      authorization: `Bearer ${connection.apiKey}`,
    },
  ]);
});

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

test('call recording separates a failed attempt from its retry and keeps only reported usage', async () => {
  const records: {
    input: string | null;
    result: Parameters<Awaited<ReturnType<ProviderCallObserver>>>[0];
  }[] = [];
  const credential = 'fixture-provider-secret';
  const reasoning = 'fixture-private-reasoning';
  let attempt = 0;
  const tracked = observeProviderFetch(
    Object.assign(
      () => {
        attempt++;
        return Promise.resolve(
          attempt === 1
            ? Response.json({ error: { message: credential } }, { status: 429 })
            : Response.json({
                choices: [
                  {
                    message: {
                      content: 'Видимый ответ',
                      reasoning_content: reasoning,
                    },
                  },
                ],
                usage: {
                  prompt_tokens: 18,
                  completion_tokens: 6,
                  prompt_tokens_details: { cached_tokens: 0 },
                  completion_tokens_details: { reasoning_tokens: 4 },
                },
              }),
        );
      },
      { preconnect: fetch.preconnect },
    ),
    (input) =>
      Promise.resolve((result) => {
        records.push({ input, result });
        return Promise.resolve();
      }),
  );
  const request = {
    headers: { authorization: `Bearer ${credential}` },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Проверь документ' },
            { type: 'image_url', image_url: { url: 'fixture-image-data' } },
          ],
        },
      ],
    }),
  };
  expect((await tracked('https://fixture.invalid', request)).status).toBe(429);
  const response = await tracked('https://fixture.invalid', request);
  expect(await response.json()).toMatchObject({
    choices: [{ message: { reasoning_content: reasoning } }],
  });
  expect(records).toMatchObject([
    {
      result: {
        status: 'failed',
        errorCode: 'HTTP_429',
        inputTokens: null,
        outputTokens: null,
        output: null,
      },
    },
    {
      result: {
        status: 'responded',
        inputTokens: 18,
        outputTokens: 6,
        cachedInputTokens: 0,
        reasoningTokens: 4,
      },
    },
  ]);
  expect(records[1]?.input).toContain('Проверь документ');
  expect(records[1]?.result.output).toContain('Видимый ответ');
  expect(JSON.stringify(records)).not.toContain(credential);
  expect(JSON.stringify(records)).not.toContain(reasoning);
  expect(JSON.stringify(records)).not.toContain('fixture-image-data');
});

test('history retains answers without usage and reads usage sent in a separate stream frame', async () => {
  const message = {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Видимый ответ' },
      { type: 'reasoning', text: 'fixture-hidden-typed-part' },
    ],
  };
  const frames = [
    { choices: [{ delta: { content: 'Видимый ответ' } }] },
    { usage: { prompt_tokens: 2, completion_tokens: 4 } },
  ]
    .map((frame) => `data: ${JSON.stringify(frame)}\n\n`)
    .join('');
  const responses = [
    Response.json({ choices: [{ message }] }),
    new Response(frames + 'data: [DONE]\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }),
  ];
  const records: Parameters<Awaited<ReturnType<ProviderCallObserver>>>[0][] =
    [];
  const tracked = observeProviderFetch(
    Object.assign(
      () => {
        const response = responses.shift();
        if (!response) throw new Error('UNEXPECTED_CALL');
        return Promise.resolve(response);
      },
      { preconnect: fetch.preconnect },
    ),
    () =>
      Promise.resolve((result) => {
        records.push(result);
        return Promise.resolve();
      }),
  );
  await tracked('https://fixture.invalid');
  const stream = await tracked('https://fixture.invalid');
  expect(await stream.text()).toBe(frames + 'data: [DONE]\n\n');
  expect(records).toHaveLength(2);
  const [plain, streamed] = records;
  expect(plain?.output ?? '').toContain('Видимый ответ');
  expect(plain?.output ?? '').not.toContain('fixture-hidden-typed-part');
  expect(streamed?.output ?? '').toContain('Видимый ответ');
  expect(plain).toMatchObject({
    status: 'responded',
    errorCode: null,
    inputTokens: null,
    outputTokens: null,
  });
  expect(streamed).toMatchObject({
    status: 'responded',
    errorCode: null,
    inputTokens: 2,
    outputTokens: 4,
  });
});

test('a failed history completion preserves the provider response and transport error', async () => {
  const response = Response.json({
    choices: [{ message: { content: 'Ответ модели' } }],
  });
  const transportError = new TypeError('fixture transport failure');
  const historyError = new Error('fixture history failure');
  let requests = 0;
  let completionWrites = 0;
  const tracked = observeProviderFetch(
    Object.assign(
      () => {
        requests++;
        return requests === 1
          ? Promise.resolve(response)
          : Promise.reject(transportError);
      },
      { preconnect: fetch.preconnect },
    ),
    () =>
      Promise.resolve(() => {
        completionWrites++;
        return Promise.reject(historyError);
      }),
  );

  const responseOrError = await tracked('https://fixture.invalid').catch(
    (error: unknown) => error,
  );
  expect(responseOrError).toBe(response);
  expect(await response.json()).toEqual({
    choices: [{ message: { content: 'Ответ модели' } }],
  });

  const failure = await tracked('https://fixture.invalid').catch(
    (error: unknown) => error,
  );
  expect(failure).toBe(transportError);
  expect(requests).toBe(2);
  expect(completionWrites).toBe(2);
});

test('compatible model metadata can publish a completion limit independently of context', async () => {
  const gateway = createModelGateway({
    fetch: Object.assign(
      () =>
        Promise.resolve(
          Response.json({ id: 'reasoner', max_output_tokens: 48000 }),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  const connection = {
    id: 'compatible',
    baseURL: 'https://fixture.invalid/v1',
    apiKey: 'fixture',
  };
  const limits = await gateway.contextLimits(
    connection,
    'reasoner',
    new AbortController().signal,
  );
  expect(limits?.completion).toBe(48000);
  expect(limits?.context).toBeNull();
});

test('the gateway rejects a published context below the configured minimum', async () => {
  const fakeFetch = Object.assign(
    (url: Parameters<typeof fetch>[0]) =>
      Promise.resolve(
        Response.json({
          context_window: new Request(url).url.endsWith('/small')
            ? 131071
            : 131072,
        }),
      ),
    { preconnect: fetch.preconnect },
  );
  const connection = {
    id: 'compatible',
    baseURL: 'https://fixture.invalid/v1',
    apiKey: 'fixture',
  };
  const signal = new AbortController().signal;
  const gateway = createModelGateway({ fetch: fakeFetch });
  const minimum = await gateway.contextLimits(connection, 'minimum', signal);
  expect(minimum?.context).toBe(131072);
  const below = await gateway
    .contextLimits(connection, 'small', signal)
    .catch((error: unknown) => error);
  expect(below).toMatchObject({ code: 'LLM_CONTEXT_TOO_SMALL' });
  const stricter = createModelGateway({
    fetch: fakeFetch,
    minModelContextTokens: 262144,
  });
  const aboveDefault = await stricter
    .contextLimits(connection, 'minimum', signal)
    .catch((error: unknown) => error);
  expect(aboveDefault).toMatchObject({ code: 'LLM_CONTEXT_TOO_SMALL' });
});
