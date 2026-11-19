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
  let origin: 'document' | 'inference' = 'document';
  let quote = 'Анна',
    referencedId = documentId,
    valid = true,
    checks = 0;
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
                  content: JSON.stringify({
                    summary: 'Сопоставлены сведения',
                    candidates: [
                      {
                        origin,
                        field: 'personName',
                        value: 'Анна',
                        evidence: [
                          { documentId: referencedId, imagePath: null, quote },
                        ],
                      },
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
          }),
        ),
      { preconnect: fetch.preconnect },
    ),
  });
  const threads: string[] = [];
  const invoke = () => {
    const threadId = crypto.randomUUID();
    threads.push(threadId);
    return agents.reconcile({
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
      fields: fieldDefinitions.filter((f) => f.key === 'personName'),
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
          ? Promise.resolve('Имя: Анна.')
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
    expect(result.candidates[0]?.origin).toBe('document');
    expect(checks).toBeGreaterThan(0);
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
