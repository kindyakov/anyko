import { expect, spyOn, test } from 'bun:test';
import { inspect } from 'node:util';

import { z } from 'zod';

import { createDatabasePool } from '@anyko/database';
import { llmError } from '@anyko/llm';

import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
import { emptyFacts } from '../../src/modules/facts';
import { requirePackage } from '../../src/modules/templates';
import { fieldDefinitions } from '../../src/profiles/bfl/fields';

test('real extraction preserves supported candidates when the model also returns a field outside the package', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const documentId = crypto.randomUUID();
  const candidate = {
    field: 'city' as const,
    value: 'Тула',
    evidence: [{ documentId, imagePath: null, quote: 'г. Тула' }],
  };
  const extra = {
    field: 'registrationAddress',
    value: 'г. Тула, ул. Мира',
    evidence: [{ documentId, imagePath: null, quote: 'г. Тула, ул. Мира' }],
  };
  let returnedCandidates = [extra, candidate];
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      () =>
        Promise.resolve(
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
                  content: JSON.stringify({ candidates: returnedCandidates }),
                },
                finish_reason: 'stop',
              },
            ],
          }),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  const threads: string[] = [];
  const fields = requirePackage('bfl-bankruptcy-v3').fields;
  const extract = (text: string) => {
    const threadId = crypto.randomUUID();
    threads.push(threadId);
    return agents.extract({
      connection: {
        id: 'fixture',
        baseURL: 'https://fixture.invalid/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: 'fixture',
      resource: crypto.randomUUID(),
      threadId,
      fields,
      document: { id: documentId, text, visuals: [] },
      signal: AbortSignal.timeout(10000),
    });
  };
  const expectInvalid = async (text: string) => {
    try {
      await extract(text);
    } catch (error) {
      expect(error).toMatchObject({ code: 'LLM_INVALID_RESPONSE' });
      return;
    }
    throw new Error('EXPECTED_INVALID_EXTRACTION');
  };
  try {
    await agents.ready();
    const result = await extract('Регистрация: г. Тула, ул. Мира');
    expect(result.candidates).toEqual([{ ...candidate, origin: 'document' }]);
    await expectInvalid('Регистрация: г. Калуга');
    returnedCandidates = [extra];
    await expectInvalid('Регистрация: г. Тула, ул. Мира');
    returnedCandidates = [];
    const empty = await extract('Сведения отсутствуют.');
    expect(empty.candidates).toEqual([]);
  } finally {
    for (const threadId of threads) await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('real coordinator validates source evidence, keeps its scope, and removes persisted attempt messages', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const documentId = crypto.randomUUID();
  const extracted = {
    field: 'personName',
    value: 'Анна',
    origin: 'document',
    evidence: [{ documentId, imagePath: null, quote: 'Анна' }],
  } as const;
  const alternative = {
    ...extracted,
    value: 'Анна Мария',
    evidence: [{ documentId, imagePath: null, quote: 'Анна Мария' }],
  } as const;
  const birthplace = {
    ...extracted,
    field: 'birthPlace',
    value: 'Тула',
    evidence: [{ documentId, imagePath: null, quote: 'Тула' }],
  } as const;
  let firstUserMessage: string | undefined;
  let firstOutputLimit: number | undefined;
  let origin: 'document' | 'inference' = 'document';
  let returnMixedCandidates = false;
  let quote = 'Анна',
    referencedId = documentId,
    valid = true,
    checks = 0;
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        if (new URL(request.url).pathname.endsWith('/endpoints')) {
          return Response.json({
            data: {
              endpoints: [
                { context_length: 1000000, max_completion_tokens: 131072 },
              ],
            },
          });
        }
        const { max_tokens } = z
          .object({ max_tokens: z.number() })
          .parse(await request.json());
        firstOutputLimit ??= max_tokens;
        return Response.json({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: 'fixture',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  summary: 'Сопоставлены сведения',
                  candidates: [
                    {
                      origin,
                      field: 'personName',
                      value: 'Анна',
                      ...(returnMixedCandidates && {
                        explanation: 'Имя явно указано в документе',
                      }),
                      evidence: [
                        { documentId: referencedId, imagePath: null, quote },
                      ],
                    },
                    ...(returnMixedCandidates
                      ? [
                          {
                            origin: 'inference',
                            field: 'postalCode',
                            value: null,
                            explanation: 'Индекс неизвестен',
                            evidence: [
                              { documentId, imagePath: null, quote: 'Анна' },
                            ],
                          },
                        ]
                      : []),
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const threads: string[] = [];
  const invoke = () => {
    const threadId = crypto.randomUUID();
    threads.push(threadId);
    return agents.reconcile({
      connection: {
        id: 'routerai',
        baseURL: 'https://routerai.ru/api/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: '~deepseek/deepseek-v4-flash-latest',
      resource: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      threadId,
      workRevision: 1,
      previousContext: null,
      facts: emptyFacts(),
      candidates: [
        {
          ...extracted,
          value: 'А'.repeat(12000),
          evidence: [...extracted.evidence],
        },
        {
          ...extracted,
          evidence: [
            { documentId: crypto.randomUUID(), imagePath: null, quote: 'Анна' },
          ],
        },
        { ...extracted, evidence: [...extracted.evidence] },
        { ...extracted, evidence: [...extracted.evidence] },
        { ...alternative, evidence: [...alternative.evidence] },
        { ...birthplace, evidence: [...birthplace.evidence] },
      ],
      observe: (input) => {
        const request = z
          .object({
            messages: z.array(
              z.object({ role: z.string(), content: z.string() }),
            ),
          })
          .safeParse(JSON.parse(input ?? '{}'));
        firstUserMessage ??= request.data?.messages.find(
          ({ role }) => role === 'user',
        )?.content;
        return Promise.resolve(() => Promise.resolve());
      },
      fields: fieldDefinitions.filter(
        ({ key }) => key === 'personName' || key === 'birthPlace',
      ),
      documents: [
        {
          id: documentId,
          filename: 'source.pdf',
          digest: 'fixture',
          images: [],
        },
      ],
      signal: AbortSignal.timeout(10000),
      assertCurrent: () => {
        checks++;
        if (!valid) return Promise.reject(new Error('SOURCE_DELETED'));
        return Promise.resolve();
      },
      readSource: (id, image) =>
        id === documentId && image === null
          ? Promise.resolve(
              'Имя: Анна. В другом фрагменте: Анна Мария. Место рождения: Тула.',
            )
          : Promise.reject(new Error('SOURCE_NOT_ALLOWED')),
    });
  };
  const failure = (operation: ReturnType<typeof invoke>) =>
    operation.then(
      () => 'UNEXPECTED_SUCCESS',
      (e: unknown) => llmError(e).code,
    );
  try {
    await agents.ready();
    const result = await invoke();
    expect(firstOutputLimit).toBe(8192);
    const initial = z
      .object({
        fields: z.object({ extracted: z.array(z.unknown()) }),
      })
      .parse(JSON.parse(firstUserMessage ?? '{}'));
    expect(initial.fields.extracted).toEqual([
      extracted,
      birthplace,
      alternative,
    ]);
    expect(result.candidates[0]?.origin).toBe('document');
    expect(checks).toBeGreaterThan(0);
    returnMixedCandidates = true;
    expect((await invoke()).candidates).toEqual(result.candidates);
    returnMixedCandidates = false;
    origin = 'inference';
    expect(await failure(invoke())).toBe('LLM_INVALID_RESPONSE');
    origin = 'document';
    quote = 'Нет такой цитаты';
    expect(await failure(invoke())).toBe('LLM_INVALID_RESPONSE');
    quote = 'Анна';
    referencedId = crypto.randomUUID();
    expect(await failure(invoke())).toBe('LLM_INVALID_RESPONSE');
    referencedId = documentId;
    valid = false;
    expect(await failure(invoke())).toBe('LLM_INVALID_RESPONSE');
  } finally {
    for (const threadId of threads) await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('provider failures do not leak document or provider bodies through SDK console logging', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const canary = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const logged: unknown[][] = [];
  const observer = spyOn(console, 'error').mockImplementation(
    (...args: unknown[]) => {
      logged.push(args);
    },
  );
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      () =>
        Promise.resolve(
          Response.json(
            { error: { message: canary, type: 'invalid_api_key' } },
            { status: 401 },
          ),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  try {
    await agents.ready();
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await agents
        .reconcile({
          connection: {
            id: 'fixture',
            baseURL: 'https://fixture.invalid/v1',
            apiKey: crypto.randomUUID(),
          },
          modelId: 'fixture',
          resource: crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          threadId,
          workRevision: 1,
          previousContext: null,
          facts: emptyFacts(),
          candidates: [],
          fields: [],
          documents: [],
          signal: AbortSignal.timeout(10000),
          assertCurrent: () => Promise.resolve(),
          readSource: () => Promise.reject(new Error('SOURCE_NOT_ALLOWED')),
        })
        .then(
          () => 'UNEXPECTED_SUCCESS',
          (error: unknown) => llmError(error).code,
        );
      expect(result).not.toBe('UNEXPECTED_SUCCESS');
    }
    expect(inspect(logged, { depth: 12 }).includes(canary)).toBe(false);
  } finally {
    observer.mockRestore();
    await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('Mastra compacts a long tool history and continues from the accepted context with an additional document', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const threadId = crypto.randomUUID();
  const nextThreadId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const resource = crypto.randomUUID();
  const oldId = crypto.randomUUID();
  const newId = crypto.randomUUID();
  const imagePath = 'images/registration.png';
  const requestSchema = z.object({
    model: z.string(),
    messages: z.array(
      z
        .object({
          role: z.string(),
          tool_call_id: z.string().optional(),
          tool_calls: z.array(z.object({ id: z.string() })).nullish(),
        })
        .loose(),
    ),
    max_tokens: z.number(),
  });
  const requests: z.infer<typeof requestSchema>[] = [];
  const history: (string | null)[] = [];
  const toolHistory: (string | null)[] = [];
  const tinyThreadId = crypto.randomUUID();
  const mixedAttempts = [
    'fixture/mixed-all-full',
    'fixture/mixed-short-first',
    'fixture/mixed-full-first',
  ].map((modelId) => ({ modelId, threadId: crypto.randomUUID() }));
  const mixedText = '@!?.:,'.repeat(1166) + '!!!!!г. Тула';
  const oldText = 'Строка большого первичного документа. '.repeat(1000);
  const oldSource = {
    id: oldId,
    filename: 'old.pdf',
    digest: 'old',
    images: [],
  };
  const longFilename = `${'ф'.repeat(196)}.pdf`;
  const otherSources = Array.from({ length: 18 }, () => ({
    ...oldSource,
    id: crypto.randomUUID(),
    filename: longFilename,
  }));
  const newSource = {
    id: newId,
    filename: longFilename,
    digest: 'new',
    images: [imagePath],
  };
  const fields = fieldDefinitions.filter(({ key }) => key === 'city');
  const candidate = {
    origin: 'document' as const,
    field: 'city' as const,
    value: 'Тула',
    evidence: [{ documentId: newId, imagePath, quote: 'г. Тула' }],
  };
  const read = (id: string, name: string, args: object) => ({
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  });
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        if (request.url.endsWith('/endpoints')) {
          const smaller = request.url.endsWith('/small/endpoints');
          const tiny = request.url.endsWith('/tiny/endpoints');
          return Response.json({
            data: {
              endpoints: [
                {
                  context_length: tiny ? 4096 : smaller ? 12288 : 8192,
                  max_completion_tokens: tiny ? 1024 : smaller ? 1500 : 1800,
                },
              ],
            },
          });
        }
        const body = requestSchema.parse(await request.json());
        requests.push(body);
        const count = requests.filter(
          (item) => item.model === body.model,
        ).length;
        const first = body.model === 'fixture/small';
        const mixed = body.model.startsWith('fixture/mixed-');
        const mixedReads = [
          read('full-page', 'readSource', { documentId: oldId, offset: 0 }),
          read('short-tail', 'readSource', {
            documentId: oldId,
            offset: body.model === 'fixture/mixed-all-full' ? 10 : 7000,
          }),
        ];
        if (body.model === 'fixture/mixed-short-first') mixedReads.reverse();
        const toolCalls =
          mixed && count === 1
            ? mixedReads
            : first && count <= 5
              ? Array.from({ length: count === 1 ? 12 : 3 }, (_, page) =>
                  read(`old-${String(count)}-${String(page)}`, 'readSource', {
                    documentId: oldId,
                    imagePath: null,
                    offset: (count - 1) * 3000 + page * 1000,
                  }),
                )
              : body.model === 'fixture/large' && count === 1
                ? [
                    read('new-images', 'listImages', {
                      documentId: newId,
                      offset: 0,
                    }),
                  ]
                : body.model === 'fixture/large' && count === 2
                  ? [
                      read('new-field', 'readField', {
                        field: 'city',
                        offset: 0,
                      }),
                      read('new-source', 'readSource', {
                        documentId: newId,
                        imagePath,
                        offset: 0,
                      }),
                    ]
                  : [];
        return Response.json({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: body.model,
          choices: [
            {
              index: 0,
              message: toolCalls.length
                ? { role: 'assistant', content: null, tool_calls: toolCalls }
                : {
                    role: 'assistant',
                    content: JSON.stringify({
                      summary: 'Нужно уточнить город',
                      candidates:
                        body.model === 'fixture/large' ? [candidate] : [],
                    }),
                  },
              finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
            },
          ],
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const input = {
    connection: {
      id: 'routerai',
      baseURL: 'https://routerai.ru/api/v1',
      apiKey: crypto.randomUUID(),
    },
    threadId,
    sessionId,
    resource,
    workRevision: 1,
    modelId: 'fixture/small',
    previousContext: null,
    facts: emptyFacts(),
    candidates: [],
    documents: [oldSource],
    fields,
    signal: AbortSignal.timeout(15000),
    assertCurrent: () => Promise.resolve(),
    readSource: (id: string, path: string | null) => {
      if (id === oldId && path === null) return Promise.resolve(oldText);
      if (id === newId && path === imagePath)
        return Promise.resolve('Адрес: г. Тула.');
      return Promise.reject(new Error('SOURCE_NOT_ALLOWED'));
    },
    observe: (message: string | null) => {
      history.push(message);
      return Promise.resolve(() => Promise.resolve());
    },
    traceTool: ({ output }: { output: string | null }) => {
      toolHistory.push(output);
      return Promise.resolve();
    },
  };
  try {
    await agents.ready();
    const first = await agents.reconcile(input);
    const smallRequests = requests.filter(
      ({ model }) => model === 'fixture/small',
    );
    expect(smallRequests).toHaveLength(6);
    for (const request of smallRequests) {
      expect(request.max_tokens).toBe(1500);
      expect(JSON.stringify(request.messages)).toContain('documents.analyzed');
      expect(
        request.messages.flatMap(
          ({ tool_calls }) => tool_calls?.map(({ id }) => id) ?? [],
        ),
      ).toEqual(
        request.messages.flatMap(({ tool_call_id }) =>
          tool_call_id ? [tool_call_id] : [],
        ),
      );
    }
    const toolIds = (request: (typeof requests)[number] | undefined) =>
      request?.messages.flatMap(({ tool_call_id }) =>
        tool_call_id ? [tool_call_id] : [],
      );
    expect(toolIds(smallRequests[1])).toContain('old-1-0');
    expect(toolIds(smallRequests[1])?.length).toBeLessThan(12);
    expect(toolIds(smallRequests[5])).not.toContain('old-1-0');
    expect(toolIds(smallRequests[5])).toContain('old-5-2');
    expect(history[1]).toContain('old-1-0');
    expect(toolHistory).toHaveLength(24);
    expect(toolHistory.every((output) => output?.includes('первичного'))).toBe(
      true,
    );

    const next = await agents.reconcile({
      ...input,
      threadId: nextThreadId,
      modelId: 'fixture/large',
      workRevision: 2,
      fields: requirePackage('bfl-bankruptcy-v6').fields,
      previousContext: {
        version: 1,
        workRevision: 1,
        inputRevision: 1,
        settingsRevision: 1,
        promptVersion: 'work-context-v1',
        summary: first.summary,
        documents: [{ id: oldId, digest: oldSource.digest }],
        missingFields: ['city'],
        conflictFields: [],
      },
      documents: [oldSource, newSource, ...otherSources],
    });
    const largeRequests = requests.filter(
      ({ model }) => model === 'fixture/large',
    );
    expect(largeRequests).toHaveLength(3);
    expect(largeRequests[0]?.max_tokens).toBe(1800);
    expect(JSON.stringify(largeRequests[0]?.messages)).toContain(first.summary);
    expect(JSON.stringify(largeRequests[0]?.messages)).toContain(
      'missingFields',
    );
    expect(JSON.stringify(largeRequests[0]?.messages)).toContain(newId);
    expect(JSON.stringify(largeRequests[0]?.messages)).toContain(
      otherSources.at(-1)?.id ?? 'missing',
    );
    expect(JSON.stringify(largeRequests[0]?.messages)).not.toContain(imagePath);
    expect(JSON.stringify(largeRequests[0]?.messages)).not.toContain(
      newSource.filename,
    );
    expect(JSON.stringify(largeRequests[1]?.messages)).toContain(imagePath);
    expect(JSON.stringify(largeRequests[1]?.messages)).toContain(
      newSource.filename,
    );
    expect(JSON.stringify(largeRequests[2]?.messages)).toContain('г. Тула');
    expect(toolIds(largeRequests[2])).toContain('new-field');
    expect(next.candidates).toEqual([candidate]);
    expect(history[1]).toContain('old-1-0');

    const tinyResult = await agents
      .reconcile({
        ...input,
        threadId: tinyThreadId,
        modelId: 'fixture/tiny',
        fields: requirePackage('bfl-bankruptcy-v6').fields,
        documents: [oldSource, newSource, ...otherSources],
      })
      .then(
        () => null,
        (error: unknown) => llmError(error).code,
      );
    expect(tinyResult).toBe('LLM_REQUEST_REJECTED');
    expect(requests.some(({ model }) => model === 'fixture/tiny')).toBe(false);

    for (const attempt of mixedAttempts) {
      const outcome = await agents
        .reconcile({
          ...input,
          ...attempt,
          fields: requirePackage('bfl-bankruptcy-v6').fields,
          documents: [oldSource, newSource, ...otherSources].map((source) => ({
            ...source,
            filename: 'Документы о составе имущества.pdf',
            images: [],
          })),
          readSource: () => Promise.resolve(mixedText),
          previousContext: {
            version: 1,
            workRevision: 1,
            inputRevision: 1,
            settingsRevision: 1,
            promptVersion: 'work-context-v1',
            summary: 'Q\u0308!/д'.repeat(800),
            documents: [],
            missingFields: [],
            conflictFields: [],
          },
        })
        .then(
          () => 'succeeded',
          (error: unknown) => llmError(error).code,
        );
      const mixedRequests = requests.filter(
        ({ model }) => model === attempt.modelId,
      );
      if (attempt.modelId === 'fixture/mixed-all-full') {
        expect(outcome).toBe('LLM_REQUEST_REJECTED');
        expect(mixedRequests).toHaveLength(1);
        continue;
      }
      expect(outcome).toBe('succeeded');
      expect(mixedRequests).toHaveLength(2);
      expect(toolIds(mixedRequests[1])).toEqual(['short-tail']);
      expect(
        mixedRequests[1]?.messages.flatMap(
          ({ tool_calls }) => tool_calls?.map(({ id }) => id) ?? [],
        ),
      ).toEqual(['short-tail']);
    }
  } finally {
    await agents.eraseThread(threadId);
    await agents.eraseThread(nextThreadId);
    await agents.eraseThread(tinyThreadId);
    for (const { threadId } of mixedAttempts)
      await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});
