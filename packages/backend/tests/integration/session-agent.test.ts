import { expect, spyOn, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';

import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import { createDatabasePool } from '@anyko/database';
import { applyCreditorRegistryCandidate } from '@anyko/document-values/obligations';
import { llmError } from '@anyko/llm';

import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
import { emptyFacts, markSelectedCandidates } from '../../src/modules/facts';
import { generateDocument } from '../../src/modules/generation';
import {
  requirePackage,
  templateBytes,
  templateData,
} from '../../src/modules/templates';
import { automaticValue } from '../../src/profiles/bfl/automatic-value';
import { fieldDefinitions } from '../../src/profiles/bfl/fields';
import { completionStream } from '../support/completion-stream';

test('real extraction preserves candidates with valid citations when other fields or citations are invalid', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const documentId = crypto.randomUUID();
  const traceDirectory = await mkdtemp(
    join(tmpdir(), 'anyko-extraction-trace-'),
  );
  let correlationId = crypto.randomUUID();
  const apiKey = crypto.randomUUID();
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
  const forged = {
    ...candidate,
    value: 'Москва',
    evidence: [
      ...candidate.evidence,
      { documentId, imagePath: null, quote: 'г. Москва' },
    ],
  };
  let returnedCandidates: unknown[] = [
    extra,
    forged,
    forged,
    { [apiKey]: apiKey },
    candidate,
  ];
  const rejections: { field: string; count: number }[] = [];
  const agents = createDocumentAgents({
    pool,
    traceDirectory,
    fetch: Object.assign(
      () =>
        Promise.resolve(
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
                  content: JSON.stringify({ candidates: returnedCandidates }),
                  reasoning_content: 'Синтетическая проверка цитаты.',
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              completion_tokens_details: { reasoning_tokens: 3 },
            },
          }),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  const threads: string[] = [];
  const fields = requirePackage('bfl-bankruptcy-v13').fields;
  const extract = (
    text: string,
    visuals: { path: string; description: string }[] = [],
  ) => {
    const threadId = crypto.randomUUID();
    threads.push(threadId);
    return agents.extract({
      connection: {
        id: 'fixture',
        baseURL: 'https://fixture.invalid/v1',
        apiKey,
      },
      modelId: 'fixture',
      resource: crypto.randomUUID(),
      threadId,
      trace: {
        correlationId,
        jobId: threadId,
        stage: 'extraction',
        documentId,
      },
      fields,
      onRejectedEvidence: (rejected) => {
        rejections.push(...rejected);
      },
      document: { id: documentId, text, visuals },
      signal: AbortSignal.timeout(10000),
    });
  };
  const expectInvalid = async (
    text: string,
    expected: { code: string; diagnosticMessage?: string } = {
      code: 'LLM_INVALID_RESPONSE',
    },
    visuals?: Parameters<typeof extract>[1],
  ) => {
    try {
      await extract(text, visuals);
    } catch (error) {
      expect(error).toMatchObject(expected);
      return;
    }
    throw new Error('EXPECTED_INVALID_EXTRACTION');
  };
  try {
    await agents.ready();
    const source = 'Регистрация: г.\n\nТула, ул. Мира';
    const grounded = {
      ...candidate,
      evidence: [{ documentId, imagePath: null, quote: 'г.\n\nТула' }],
      origin: 'document' as const,
    };
    const result = await extract(source);
    expect(result.candidates).toEqual([grounded]);
    expect(rejections).toEqual([{ field: 'city', count: 2 }]);
    const traces = join(traceDirectory, correlationId);
    const [file, ...others] = await readdir(traces);
    expect(others).toEqual([]);
    if (!file) throw new Error('MISSING_EXTRACTION_TRACE');
    expect(file).toContain(`extraction-${documentId}-1-`);
    const trace = await readFile(join(traces, file), 'utf8');
    expect(trace).not.toContain(apiKey);
    expect(trace).toContain(
      'Цитируй содержимое одной ячейки как оно записано в тексте.',
    );
    expect(trace).toContain(
      'Не переноси разметку из описания картинки в текстовую цитату.',
    );
    expect(trace).toContain(
      'Если полный номер есть в тексте, процитируй его из текста (imagePath=null).',
    );
    expect(trace).toContain(JSON.stringify(source).slice(1, -1));
    const record: unknown = JSON.parse(trace);
    const wireSchema = z
      .object({
        prompt: z.object({
          response_format: z.object({
            json_schema: z.object({
              strict: z.literal(true),
              schema: z.object({
                properties: z.object({
                  candidates: z.object({
                    items: z.object({
                      anyOf: z.array(
                        z.object({
                          properties: z
                            .object({
                              field: z.object({ enum: z.array(z.string()) }),
                            })
                            .loose(),
                        }),
                      ),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .parse(record).prompt.response_format.json_schema.schema;
    expect(
      wireSchema.properties.candidates.items.anyOf.find(({ properties }) =>
        properties.field.enum.includes('city'),
      )?.properties,
    ).toMatchObject({
      value: { type: 'string' },
      evidence: {
        items: {
          anyOf: [
            { required: ['documentId', 'imagePath', 'quote'] },
            {
              required: ['documentId', 'imagePath', 'quote', 'page'],
              properties: { page: { type: 'integer', minimum: 1 } },
            },
          ],
        },
      },
    });
    expect(record).toMatchObject({
      finishReason: 'stop',
      reasoning: 'Синтетическая проверка цитаты.',
      usage: { reasoningTokens: 3 },
      parse: {
        status: 'accepted',
        accepted: [grounded],
        discarded: [
          { candidate: extra, reason: 'schema' },
          { candidate: forged, reason: 'quote_not_found' },
          { candidate: forged, reason: 'quote_not_found' },
          { candidate: { '[redacted]': '[redacted]' }, reason: 'schema' },
        ],
      },
    });
    await expectInvalid('Регистрация: г. Калуга');
    returnedCandidates = [{ ...forged, evidence: [] }, candidate];
    const recovered = await extract('Регистрация: г. Тула, ул. Мира');
    expect(recovered.candidates).toEqual([
      { ...candidate, origin: 'document' },
    ]);
    returnedCandidates = [forged];
    await expectInvalid('Регистрация: г. Тула, ул. Мира', {
      code: 'LLM_EVIDENCE_NOT_FOUND',
    });
    returnedCandidates = [extra];
    await expectInvalid('Регистрация: г. Тула, ул. Мира');
    returnedCandidates = [
      {
        ...candidate,
        evidence: [{ ...candidate.evidence[0], page: 0 }],
      },
    ];
    await expectInvalid('Регистрация: г. Тула, ул. Мира');
    returnedCandidates = [];
    const empty = await extract('Сведения отсутствуют.');
    expect(empty.candidates).toEqual([]);
    correlationId = crypto.randomUUID();
    const blockedDirectory = join(traceDirectory, correlationId);
    await writeFile(blockedDirectory, 'occupied');
    returnedCandidates = [candidate];
    const withFailedTrace = await extract('Регистрация: г. Тула');
    expect(withFailedTrace.candidates).toEqual([
      { ...candidate, origin: 'document' },
    ]);
    expect(await readFile(blockedDirectory, 'utf8')).toBe('occupied');

    // Synthetic test number with valid check digits.
    const inn = '999900000097';
    const table = `<table><tr><td>2</td><td>ИНН</td><td>${inn}</td></tr></table>`;
    const visual = {
      path: 'images/page_0_table_2.jpg',
      description: `2 | ИНН | ${inn}`,
    };
    const pipeCitation = {
      documentId,
      imagePath: null,
      quote: visual.description,
    };
    const innCandidate = {
      field: 'inn' as const,
      value: inn,
      evidence: [pipeCitation],
    };
    returnedCandidates = [innCandidate];
    await expectInvalid(
      table,
      {
        code: 'LLM_EVIDENCE_NOT_FOUND',
        diagnosticMessage: 'Цитаты модели не найдены в источнике.',
      },
      [visual],
    );
    expect(rejections.at(-1)).toEqual({ field: 'inn', count: 1 });

    const cellCitation = { ...pipeCitation, quote: inn };
    returnedCandidates = [{ ...innCandidate, evidence: [cellCitation] }];
    for (const text of [
      table,
      `| Поле | Номер |\n| --- | --- |\n| ИНН | ${inn} |`,
    ]) {
      const textual = await extract(text, [visual]);
      expect(textual.candidates).toEqual([
        { ...innCandidate, origin: 'document', evidence: [cellCitation] },
      ]);
      expect(textual.candidates.map((entry) => automaticValue(entry))).toEqual([
        inn,
      ]);
    }

    const imageCitation = { ...pipeCitation, imagePath: visual.path };
    returnedCandidates = [{ ...innCandidate, evidence: [imageCitation] }];
    const visualOnly = await extract('Выписка.', [visual]);
    expect(visualOnly.candidates).toEqual([
      { ...innCandidate, origin: 'document', evidence: [imageCitation] },
    ]);
    expect(visualOnly.candidates.map((entry) => automaticValue(entry))).toEqual(
      [null],
    );
  } finally {
    for (const threadId of threads) await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
    await rm(traceDirectory, { recursive: true, force: true });
  }
});

test('extraction uses the published maximum, repairs wrapped JSON and never retries the completion limit', async () => {
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
  const modelId = '~deepseek/deepseek-v4-flash-latest';
  const smallerModelId = `${modelId}-smaller`;
  const unknownModelId = `${modelId}-unknown`;
  const longSource = 'Регистрация: г. Тула. '.padEnd(64000, 'я');
  let receivedLongSource = false;
  const requests: {
    max_tokens: number;
    reasoning?: { effort: string } | undefined;
  }[] = [];
  const threads: string[] = [];
  let responses: { content: string; finish: 'stop' | 'length' }[] = [];
  const valid = {
    content: `Результат {\n\`\`\`json\n${JSON.stringify({ candidates: [candidate] })}\n\`\`\`\nКонец ответа {примечание}`,
    finish: 'stop' as const,
  };
  const malformed = { content: '{"candidates":[', finish: 'stop' as const };
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (request: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = new Request(request, init).url;
        if (url.endsWith('/endpoints')) {
          if (url.endsWith(`/${unknownModelId}/endpoints`))
            return new Response(null, { status: 503 });
          const cap = url.endsWith(`/${smallerModelId}/endpoints`)
            ? 48000
            : 131072;
          return Response.json({
            data: {
              endpoints: [
                { context_length: 262144, max_completion_tokens: cap },
              ],
            },
          });
        }
        expect(
          (init as (RequestInit & { timeout?: boolean }) | undefined)?.timeout,
        ).toBe(false);
        const body = z
          .object({
            max_tokens: z.number(),
            reasoning: z.object({ effort: z.string() }).optional(),
            messages: z.array(
              z.object({ role: z.string(), content: z.unknown() }),
            ),
          })
          .parse(await new Response(init?.body).json());
        requests.push(body);
        receivedLongSource ||= body.messages.some(
          ({ role, content }) =>
            role === 'user' &&
            typeof content === 'string' &&
            content.includes('я'.repeat(63000)),
        );
        const response = responses.shift();
        if (!response) throw new Error('UNEXPECTED_PROVIDER_CALL');
        return completionStream({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: response.content,
              },
              finish_reason: response.finish,
            },
          ],
          usage: {
            prompt_tokens: 1200,
            completion_tokens: 7045,
            completion_tokens_details: {
              reasoning_tokens: 7000,
            },
          },
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const extract = (
    selectedModel = modelId,
    enableReasoning = true,
    text = 'Регистрация: г. Тула',
  ) => {
    const threadId = crypto.randomUUID();
    threads.push(threadId);
    return agents.extract({
      connection: {
        id: 'routerai',
        baseURL: 'https://routerai.ru/api/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: selectedModel,
      enableReasoning,
      resource: crypto.randomUUID(),
      threadId,
      fields: requirePackage('bfl-bankruptcy-v12').fields,
      document: { id: documentId, text, visuals: [] },
      signal: AbortSignal.timeout(10000),
    });
  };
  try {
    await agents.ready();
    responses = [valid, valid];
    expect(
      (await extract(unknownModelId, true, longSource)).candidates,
    ).toEqual([{ ...candidate, origin: 'document' }]);
    expect(receivedLongSource).toBe(true);
    const result = await extract();
    expect(result.candidates).toEqual([{ ...candidate, origin: 'document' }]);
    expect(requests.map(({ max_tokens }) => max_tokens)).toEqual([
      64000, 131072,
    ]);
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 7045 });
    responses = [{ ...malformed, finish: 'length' }];
    const limited = await extract(smallerModelId).catch(
      (error: unknown) => error,
    );
    expect(limited).toMatchObject({ code: 'LLM_COMPLETION_LIMIT' });
    expect(requests.map(({ max_tokens }) => max_tokens)).toEqual([
      64000, 131072, 48000,
    ]);
    responses = [malformed, valid];
    const recovered = await extract(smallerModelId, false);
    expect(recovered.candidates).toEqual(result.candidates);
    expect(recovered.usage).toEqual({ inputTokens: 2400, outputTokens: 14090 });
    responses = [malformed, malformed];
    const exhausted = await extract(smallerModelId).catch(
      (error: unknown) => error,
    );
    expect(exhausted).toMatchObject({ code: 'LLM_INVALID_RESPONSE' });
    expect(requests.map(({ max_tokens }) => max_tokens)).toEqual([
      64000, 131072, 48000, 48000, 48000, 48000, 48000,
    ]);
    expect(requests.map(({ reasoning }) => reasoning?.effort)).toEqual([
      'high',
      'high',
      'high',
      'medium',
      'medium',
      'high',
      'high',
    ]);
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
  let responseFormats: ((body: string) => string)[] = [];
  let calls = 0;
  let source =
    'Имя: Анна. В другом фрагменте: Анна Мария. Место рождения: Тула.';
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
        calls++;
        const formatResponse =
          responseFormats.shift() ?? ((body: string) => body);
        return completionStream({
          id: 'fixture',
          object: 'chat.completion',
          created: 1,
          model: 'fixture',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: formatResponse(
                  JSON.stringify({
                    summary: 'Сопоставлены сведения',
                    candidates: [
                      {
                        origin,
                        field: 'personName',
                        value: 'Анна',
                        explanation: null,
                        evidence: [
                          {
                            documentId: referencedId,
                            imagePath: null,
                            quote,
                          },
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
                                {
                                  documentId,
                                  imagePath: null,
                                  quote: 'Анна',
                                },
                              ],
                            },
                          ]
                        : []),
                    ],
                  }),
                ),
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
          value: 'А'.repeat(20000),
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
      checklistRequirements: [
        {
          key: 'passport',
          label: 'Паспорт',
          documentKind: 'passport',
          applicability: 'usual',
        },
      ],
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
          ? Promise.resolve(source)
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
    responseFormats = [(body) => '```json\n' + body + '\n```'];
    const result = await invoke();
    expect(calls).toBe(1);
    expect(result).not.toHaveProperty('checklistSuggestions');
    expect(firstOutputLimit).toBe(131072);
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
    for (const table of [
      '<table><tr><td>Имя</td><td>Анна</td></tr></table>',
      '| Поле | Значение |\n| --- | --- |\n| Имя | Анна |',
    ]) {
      source = table;
      expect((await invoke()).candidates).toEqual([
        { ...extracted, evidence: [...extracted.evidence] },
      ]);
    }
    source = 'Имя: Анна. В другом фрагменте: Анна Мария. Место рождения: Тула.';
    const beforeRetry = calls;
    responseFormats = [() => '{"summary":', (body) => '```\n' + body + '\n```'];
    const repaired = await invoke();
    expect(calls - beforeRetry).toBe(2);
    expect(repaired.candidates).toEqual([
      { ...extracted, evidence: [...extracted.evidence] },
    ]);
    expect(repaired.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    const beforeExhausted = calls;
    responseFormats = [() => 'no JSON', () => 'still no JSON'];
    expect(await failure(invoke())).toBe('LLM_INVALID_RESPONSE');
    expect(calls - beforeExhausted).toBe(2);
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

test.each([131072, null])(
  'chat reports an incomplete model reply for route output %s',
  async (publishedLimit) => {
    const pool = createDatabasePool(
      z.url().parse(process.env.TEST_DATABASE_URL),
    );
    const agents = createDocumentAgents({
      pool,
      fetch: Object.assign(
        async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
          const request = new Request(url, init);
          if (!request.url.endsWith('/chat/completions'))
            return Response.json({
              context_length: 262144,
              max_completion_tokens: publishedLimit,
            });
          const body = z
            .object({ max_tokens: z.number() })
            .parse(await request.json());
          expect(body.max_tokens).toBe(publishedLimit ?? 64000);
          return completionStream({
            id: 'fixture',
            object: 'chat.completion',
            created: 1,
            model: 'fixture',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Начало ответа' },
                finish_reason: 'length',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          });
        },
        { preconnect: fetch.preconnect },
      ),
    });
    try {
      const streamed: string[] = [];
      const result = await agents
        .chat({
          connection: {
            id: 'fixture',
            baseURL: 'https://fixture.invalid/v1',
            apiKey: 'fixture',
          },
          modelId: 'fixture',
          fields: [],
          facts: emptyFacts(),
          documents: [],
          listSourceImages: () => Promise.resolve([]),
          readSource: () => Promise.reject(new Error('UNEXPECTED_SOURCE_READ')),
          assertCurrent: () => Promise.resolve(),
          previousContext: null,
          messages: [],
          userText: 'Проверь сведения',
          appliedFields: [],
          writeField: () => Promise.resolve({ errorCode: 'UNEXPECTED_WRITE' }),
          signal: AbortSignal.timeout(10_000),
          onDelta: ({ text }) => streamed.push(text),
        })
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(result).toMatchObject({ code: 'LLM_COMPLETION_LIMIT' });
      expect(streamed.join('')).toBe('Начало ответа');
    } finally {
      await agents.stop();
      await pool.end();
    }
  },
);

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
  const oversizedThreadId = crypto.randomUUID();
  const mixedAttempts = [
    'fixture/mixed-all-full',
    'fixture/mixed-short-first',
    'fixture/mixed-full-first',
  ].map((modelId) => ({ modelId, threadId: crypto.randomUUID() }));
  const contextWindow = 131072;
  const answerLimit = 64000;
  // Fit the mandatory input and a short tool result, but not a full source page.
  const mixedSummary = 'Q\u0308!/д'.repeat(24000);
  const mixedText = '@!?.:,'.repeat(3000) + '!!!!!г. Тула';
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
          return Response.json({
            data: {
              endpoints: [
                {
                  context_length: contextWindow,
                  max_completion_tokens: answerLimit,
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
            offset:
              body.model === 'fixture/mixed-all-full'
                ? 10
                : mixedText.length - 12,
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
        return completionStream({
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
                        body.model === 'fixture/large'
                          ? [
                              {
                                ...candidate,
                                explanation: null,
                              },
                            ]
                          : [],
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
      expect(request.max_tokens).toBe(answerLimit);
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
      fields: requirePackage('bfl-bankruptcy-v12').fields,
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
    expect(largeRequests[0]?.max_tokens).toBe(answerLimit);
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

    const oversizedResult = await agents
      .reconcile({
        ...input,
        threadId: oversizedThreadId,
        modelId: 'fixture/oversized-input',
        fields: requirePackage('bfl-bankruptcy-v12').fields,
        documents: [oldSource, newSource, ...otherSources],
        previousContext: {
          version: 1,
          workRevision: 1,
          inputRevision: 1,
          settingsRevision: 1,
          promptVersion: 'work-context-v1',
          summary: mixedSummary.repeat(2),
          documents: [],
          missingFields: [],
          conflictFields: [],
        },
      })
      .then(
        () => null,
        (error: unknown) => llmError(error).code,
      );
    expect(oversizedResult).toBe('LLM_REQUEST_REJECTED');
    expect(
      requests.some(({ model }) => model === 'fixture/oversized-input'),
    ).toBe(false);

    for (const attempt of mixedAttempts) {
      const previousToolCount = toolHistory.length;
      const outcome = await agents
        .reconcile({
          ...input,
          ...attempt,
          fields: requirePackage('bfl-bankruptcy-v12').fields,
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
            summary: mixedSummary,
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
        expect(toolHistory.slice(previousToolCount)).toHaveLength(2);
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
    await agents.eraseThread(oversizedThreadId);
    for (const { threadId } of mixedAttempts)
      await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('reconciliation finalizes with cited candidates after a parallel batch exhausts its read allowance', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const threadId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const quote = 'Место рождения: город Тула';
  const candidate = {
    field: 'birthPlace' as const,
    origin: 'document' as const,
    value: 'город Тула',
    evidence: [{ documentId, imagePath: null, quote }],
  };
  const response = (message: object, finishReason: string) =>
    completionStream({
      id: 'fixture',
      object: 'chat.completion',
      created: 1,
      model: 'fixture',
      choices: [{ index: 0, message, finish_reason: finishReason }],
    });
  let requests = 0;
  const failedTools: (string | undefined)[] = [];
  const readSource = spyOn({ read: () => Promise.resolve(quote) }, 'read');
  const agents = createDocumentAgents({
    pool,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        if (request.url.endsWith('/endpoints'))
          return Response.json({
            data: {
              endpoints: [
                { context_length: 131072, max_completion_tokens: 64000 },
              ],
            },
          });
        const body = z
          .object({
            tools: z.array(z.unknown()).optional(),
            tool_choice: z.string().optional(),
          })
          .parse(await request.json());
        const turn = ++requests;
        if (body.tool_choice === 'none' || !body.tools?.length)
          return response(
            {
              role: 'assistant',
              content: JSON.stringify({
                summary: 'Место рождения подтверждено.',
                candidates: [
                  {
                    ...candidate,
                    explanation: null,
                  },
                ],
              }),
            },
            'stop',
          );
        if (turn >= 10)
          return response(
            { role: 'assistant', content: 'Продолжаю чтение.' },
            'stop',
          );
        return response(
          {
            role: 'assistant',
            content: null,
            tool_calls: Array.from(
              { length: turn < 8 ? 3 : 2 },
              (_, index) => ({
                id: `read-${String(turn)}-${String(index)}`,
                type: 'function',
                function: {
                  name: 'readSource',
                  arguments: JSON.stringify({ documentId }),
                },
              }),
            ),
          },
          'tool_calls',
        );
      },
      { preconnect: fetch.preconnect },
    ),
  });
  try {
    await agents.ready();
    const result = await agents.reconcile({
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
      fields: requirePackage('bfl-bankruptcy-v12').fields,
      candidates: [],
      documents: [
        {
          id: documentId,
          filename: 'birth.pdf',
          digest: 'fixture',
          images: [],
        },
      ],
      signal: AbortSignal.timeout(15000),
      assertCurrent: () => Promise.resolve(),
      readSource,
      traceTool: ({ status, errorCode }) => {
        if (status === 'failed') failedTools.push(errorCode);
        return Promise.resolve();
      },
    });
    expect(result.candidates).toEqual([candidate]);
    expect(failedTools).toEqual(['CONTEXT_TOOL_LIMIT']);
    expect(requests).toBe(10);
    expect(readSource).toHaveBeenCalledTimes(25);
  } finally {
    await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('court lookup uses only the territory and sends verified address alternatives to review', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const threadId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const territory = 'Московская область';
  const officialName = 'Арбитражный суд Московской области';
  const contactUrl = 'https://asmo.arbitr.ru/about/mode';
  const addresses = [
    '107053, Москва, пр-кт Академика Сахарова, 18',
    '107053, Москва, Садовая-Спасская, 18',
  ] as const;
  const requested: string[] = [];
  const traced: string[] = [];
  let generation = 0;
  const agents = createDocumentAgents({
    pool,
    fetchCourtPage: (url) => {
      requested.push(url);
      if (url === 'https://arbitr.ru/ac/map') {
        return Promise.resolve(
          Response.json([
            {
              ac1: [
                {
                  name: officialName,
                  s_name: 'Московской области',
                  cityname: 'Москва',
                  region_type: 3,
                  url: 'http://asmo.arbitr.ru',
                },
              ],
            },
          ]),
        );
      }
      return Promise.resolve(
        new Response(
          '<div class="info-page__text"><table>' +
            '<tr><td>Почтовый адрес:</td><td>' +
            addresses[0] +
            '</td></tr>' +
            '<tr><td>Адрес местонахождения суда:</td><td>' +
            addresses[1] +
            '</td></tr>' +
            '</table></div>',
        ),
      );
    },
    fetch: Object.assign(
      (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        if (request.url.endsWith('/endpoints'))
          return Promise.resolve(
            Response.json({
              data: {
                endpoints: [
                  { context_length: 131072, max_completion_tokens: 64000 },
                ],
              },
            }),
          );
        generation++;
        return Promise.resolve(
          completionStream({
            id: 'fixture',
            object: 'chat.completion',
            created: 1,
            model: 'fixture',
            choices: [
              {
                index: 0,
                message:
                  generation === 1
                    ? {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                          {
                            id: 'lookup',
                            type: 'function',
                            function: {
                              name: 'lookupArbitrationCourt',
                              arguments: JSON.stringify({ territory }),
                            },
                          },
                        ],
                      }
                    : {
                        role: 'assistant',
                        content: JSON.stringify({
                          summary: 'Проверьте адрес суда.',
                          candidates: [],
                        }),
                      },
                finish_reason: generation === 1 ? 'tool_calls' : 'stop',
              },
            ],
          }),
        );
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const pack = requirePackage('bfl-bankruptcy-v12');
  try {
    await agents.ready();
    const result = await agents.reconcile({
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
      fields: pack.fields,
      candidates: [
        {
          field: 'region',
          origin: 'document',
          value: territory,
          evidence: [{ documentId, imagePath: null, quote: territory }],
        },
      ],
      documents: [
        {
          id: documentId,
          filename: 'registration.pdf',
          digest: 'fixture',
          images: [],
        },
      ],
      signal: AbortSignal.timeout(10000),
      assertCurrent: () => Promise.resolve(),
      readSource: () =>
        Promise.resolve(
          'Адрес регистрации: ' + territory + ', г. Химки, ул. Мира, д. 12.',
        ),
      traceTool: ({ input }) => {
        traced.push(input);
        return Promise.resolve();
      },
    });
    expect(requested).toEqual(['https://arbitr.ru/ac/map', contactUrl]);
    expect(traced).toEqual([
      JSON.stringify({
        tool: 'lookup-arbitration-court',
        arguments: { territory },
      }),
    ]);
    expect(result.candidates.map(({ field, value }) => [field, value])).toEqual(
      [
        ['courtName', officialName],
        ...addresses.map((address) => ['courtAddress', address]),
      ],
    );
    for (const candidate of result.candidates) {
      expect(candidate.explanation).toContain('несколько вариантов');
      expect(Date.parse(candidate.courtSources?.checkedAt ?? '')).not.toBeNaN();
      expect(candidate).toMatchObject({
        origin: 'inference',
        courtSources: {
          catalogueUrl: 'https://arbitr.ru/',
          contactUrl,
        },
        evidence: [{ documentId, imagePath: null, quote: territory }],
      });
    }
    const statement = pack.documents.find(({ id }) => id === 'statement');
    if (!statement) throw new Error('EXPECTED_STATEMENT');
    const values = {
      ...emptyFacts().values,
      courtName:
        result.candidates.find(({ field }) => field === 'courtName')?.value ??
        null,
      courtAddress:
        result.candidates.find(({ value }) => value === addresses[1])?.value ??
        null,
    };
    const xml = unzipSync(
      generateDocument(
        templateBytes(statement.version),
        templateData(values, statement.version, statement.placeholders),
      ),
    )['word/document.xml'];
    if (!xml) throw new Error('EXPECTED_STATEMENT_XML');
    const header = strFromU8(xml);
    expect(header).toContain(officialName);
    expect(header).toContain(addresses[1]);
    expect(header).not.toContain(addresses[0]);
  } finally {
    await agents.eraseThread(threadId);
    await agents.stop();
    await pool.end();
  }
});

test('official creditor details stay a proposal until selecting them for the linked contract', async () => {
  const databaseUrl = z
    .url()
    .refine((url) =>
      /^\/anyko_test(?:_[a-z0-9_]+)?$/u.test(new URL(url).pathname),
    )
    .parse(process.env.TEST_DATABASE_URL);
  const pool = createDatabasePool(databaseUrl);
  const threadId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const resource = crypto.randomUUID();
  const quote = 'Кредитор: ПАО ВТБ, адрес: г. Москва, ИНН 7702070139';
  const row = {
    name: 'ПАО ВТБ',
    inn: '7702070139',
    contractNumber: 'K-42',
    contractDate: '2024-11-01',
    amountDate: '2025-04-12',
    amount: '720.50',
    debtStatus: 'Действует',
  };
  const fullName = 'Банк ВТБ (публичное акционерное общество)';
  const address = 'Москва, наб. Пресненская, д. 10';
  const ground = {
    field: 'debts' as const,
    value: [row],
    origin: 'document' as const,
    evidence: [{ documentId, imagePath: null, quote }],
  };
  const otherSources = [
    { quote: 'АО Пример Плюс, номер договора 1234567890', name: 'АО Пример' },
    { quote: 'АО Пример', name: 'АО Пример', text: 'АО Пример Плюс' },
    {
      quote: 'АО «Пример, Плюс», номер договора 1234567890',
      name: 'АО Пример',
    },
    {
      quote: 'АО Эталон, номер договора 1234567890',
      name: 'АО Эталон',
      inn: '1234567890',
    },
    {
      quote:
        'Кредитор: АО Образец, адрес: г. Москва, АО Пример, ИНН 7707083893',
      name: 'АО Образец',
      inn: '7707083893',
    },
    {
      quote:
        'Кредитор: АО Образец; адрес: г. Москва Представитель АО Пример; ИНН 7707083893',
      name: 'АО Образец',
      inn: '7707083893',
      contractNumber: 'K-44',
    },
    {
      quote: 'АО Проверка, ИНН 1234567891',
      name: 'АО Проверка',
      inn: '1234567891',
      scope: 'outside',
    },
  ].map((source) => ({ id: crypto.randomUUID(), ...source }));
  const otherCandidates = otherSources.map((source) => ({
    ...ground,
    value: [
      {
        name: source.name,
        inn: source.inn ?? null,
        contractNumber: source.contractNumber ?? 'K-43',
      },
    ],
    evidence: [{ documentId: source.id, imagePath: null, quote: source.quote }],
  }));
  const documentIds = [
    documentId,
    ...otherSources
      .filter(({ scope }) => scope !== 'outside')
      .map(({ id }) => id),
  ];
  const readSource = (id: string) => {
    const source = otherSources.find((entry) => entry.id === id);
    return Promise.resolve(
      id === documentId ? quote : (source?.text ?? source?.quote ?? ''),
    );
  };
  const facts = emptyFacts();
  facts.values.debts = [
    row,
    { name: 'АО «Другой кредитор»', basis: 'договор М-6', amount: '10.00' },
    ...otherCandidates.flatMap(({ value }) => value),
  ];
  facts.manual.push('debts');
  facts.candidates.push(ground, ...otherCandidates);
  const requests: string[] = [];
  const registryUrls: string[] = [];
  const rejectedLookup = 'ООО Человек Из Переписки';
  let chatMode = false;
  let chatResponses = 0;
  let unavailable = false;
  const agents = createDocumentAgents({
    pool,
    fetchCreditorPage: (url, init) => {
      registryUrls.push(url);
      requests.push(typeof init.body === 'string' ? init.body : '');
      return Promise.resolve(
        unavailable
          ? new Response(null, { status: 503 })
          : new Response(
              '<Envelope><GetFullInfoByINNResult><OGRN>1027739609391</OGRN><INN>7702070139</INN><ShortName>ПАО ВТБ</ShortName><Name>' +
                fullName +
                '</Name><Address>' +
                address +
                '</Address></GetFullInfoByINNResult></Envelope>',
            ),
      );
    },
    fetch: Object.assign(
      (url: Parameters<typeof fetch>[0], init?: RequestInit) =>
        Promise.resolve(
          new Request(url, init).method === 'GET'
            ? Response.json({
                data: {
                  endpoints: [
                    { context_length: 131072, max_completion_tokens: 64000 },
                  ],
                },
              })
            : (chatMode ? Response.json.bind(Response) : completionStream)({
                id: 'fixture',
                object: 'chat.completion',
                created: 1,
                model: 'fixture',
                choices: [
                  {
                    index: 0,
                    ...(chatMode && chatResponses++ === 0
                      ? {
                          message: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [
                              { source: 'cbr', name: rejectedLookup },
                              { source: 'cbr', name: 'АО Пример' },
                              { source: 'cbr', inn: '1234567890' },
                              { source: 'cbr', inn: '1234567891' },
                              { source: 'cbr', inn: '7707083893' },
                              {
                                source: 'cbr',
                                name: 'ПАО ВТБ',
                                inn: '7702070139',
                              },
                            ].map((args, index) => ({
                              id: `creditor-${String(index)}`,
                              type: 'function',
                              function: {
                                name: 'lookupCreditorRegistry',
                                arguments: JSON.stringify(args),
                              },
                            })),
                          },
                          finish_reason: 'tool_calls',
                        }
                      : {
                          message: {
                            role: 'assistant',
                            content: chatMode
                              ? 'Проверьте реквизиты.'
                              : JSON.stringify({
                                  summary: 'Сверьте реквизиты.',
                                  candidates: [],
                                }),
                          },
                          finish_reason: 'stop',
                        }),
                  },
                ],
              }),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  const pack = requirePackage('bfl-bankruptcy-v12');
  const reconcile = () =>
    agents.reconcile({
      connection: {
        id: 'fixture',
        baseURL: 'https://fixture.invalid/v1',
        apiKey: crypto.randomUUID(),
      },
      modelId: 'fixture',
      resource,
      sessionId: crypto.randomUUID(),
      threadId,
      workRevision: 1,
      previousContext: null,
      facts,
      fields: pack.fields,
      candidates: [ground, ...otherCandidates],
      documents: documentIds.map((id) => ({
        id,
        filename: 'certificate.pdf',
        digest: 'fixture',
        images: [],
      })),
      signal: AbortSignal.timeout(10000),
      assertCurrent: () => Promise.resolve(),
      readSource,
    });
  try {
    await agents.ready();
    const result = await reconcile();
    expect(requests).toHaveLength(1);
    expect(registryUrls).toEqual(['https://www.cbr.ru/FO_ZoomWS/FinOrg.asmx']);
    expect(requests[0]).toContain('<INN>7702070139</INN>');
    expect(requests[0]).not.toContain('K-42');
    expect(result.candidates).toHaveLength(1);
    const proposal = result.candidates[0];
    expect(proposal).toMatchObject({
      origin: 'inference',
      field: 'debts',
      evidence: ground.evidence,
      creditorSource: {
        registry: 'cbr',
        url: 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027739609391',
      },
    });
    expect(Date.parse(proposal?.creditorSource?.checkedAt ?? '')).not.toBeNaN();
    if (!proposal || !Array.isArray(proposal.value))
      throw new Error('EXPECTED_CREDITOR_PROPOSAL');
    const reviewed = {
      ...facts,
      values: { ...facts.values, debts: facts.values.debts.slice(0, 2) },
      candidates: [ground, proposal],
    };
    expect(markSelectedCandidates(reviewed)[1]?.selected).toBe(false);
    const patched = applyCreditorRegistryCandidate(
      reviewed.values.debts,
      proposal.value,
    );
    expect(patched).toMatchObject([
      { amount: '720.50', address, creditorLegalName: fullName },
      { name: 'АО «Другой кредитор»', amount: '10.00' },
    ]);
    expect(
      markSelectedCandidates({
        ...reviewed,
        values: { ...reviewed.values, debts: patched ?? null },
      })[1]?.selected,
    ).toBe(true);
    const data = templateData(
      { ...reviewed.values, debts: patched ?? null },
      'bfl-statement-v11',
    );
    expect(data.creditorHeaders?.[0]).toMatchObject({
      name: fullName + ' (ПАО ВТБ)',
      address,
      inn: '7702070139',
    });
    expect(
      templateData(
        { ...reviewed.values, debts: patched ?? null },
        'bfl-creditors-v3',
      ).debts,
    ).toMatchObject([
      { name: fullName, address, amount: '720,50' },
      { amount: '10,00' },
    ]);

    unavailable = true;
    const failedLookup = await reconcile();
    expect(failedLookup.candidates).toEqual([]);
    expect(failedLookup.summary).toContain('Не удалось проверить');
    expect(registryUrls.slice(1)).toEqual([
      'https://www.cbr.ru/FO_ZoomWS/FinOrg.asmx',
      'https://pb.nalog.ru/search-proc.json',
    ]);

    unavailable = false;
    chatMode = true;
    const chat = (documentIds: string[]) =>
      agents.chat({
        connection: {
          id: 'fixture',
          baseURL: 'https://fixture.invalid/v1',
          apiKey: crypto.randomUUID(),
        },
        modelId: 'fixture',
        previousContext: null,
        facts,
        fields: pack.fields,
        documents: documentIds.map((id) => ({
          id,
          filename: 'certificate.pdf',
        })),
        messages: [],
        userText: 'Проверь реквизиты кредитора.',
        appliedFields: [],
        listSourceImages: () => Promise.resolve([]),
        readSource,
        assertCurrent: () => Promise.resolve(),
        writeField: () => Promise.resolve({ errorCode: 'UNEXPECTED_WRITE' }),
        signal: AbortSignal.timeout(10_000),
      });
    const beforeChat = requests.length;
    await chat([crypto.randomUUID()]);
    expect(requests).toHaveLength(beforeChat);
    chatResponses = 0;
    await chat(documentIds);
    expect(requests).toHaveLength(beforeChat + 1);
    expect(requests[beforeChat]).toContain('<INN>7702070139</INN>');
  } finally {
    await agents.eraseThread(threadId);
    await pool.end();
  }
});
