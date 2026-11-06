import { test, expect, spyOn } from 'bun:test';
import { inspect } from 'node:util';
import { z } from 'zod';
import { emptyFacts } from '../../src/modules/facts';
import { fieldDefinitions } from '@anyko/contracts';
import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
import { llmError } from '@anyko/llm';

test('real coordinator validates source evidence, keeps its scope, and removes persisted attempt messages', async () => {
  const databaseUrl = z
    .url()
    .refine((url) => new URL(url).pathname === '/anyko_test')
    .parse(process.env.TEST_DATABASE_URL);
  const documentId = crypto.randomUUID();
  let quote = 'Анна',
    referencedId = documentId,
    valid = true,
    checks = 0;
  const agents = createDocumentAgents({
    databaseUrl,
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
    expect(result.candidates[0]?.origin).toBe('context');
    expect(checks).toBeGreaterThan(0);
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
  }
});

test('provider failures do not leak document or provider bodies through SDK console logging', async () => {
  const databaseUrl = z
    .url()
    .refine((url) => new URL(url).pathname === '/anyko_test')
    .parse(process.env.TEST_DATABASE_URL);
  const canary = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const logged: unknown[][] = [];
  const observer = spyOn(console, 'error').mockImplementation(
    (...args: unknown[]) => {
      logged.push(args);
    },
  );
  const agents = createDocumentAgents({
    databaseUrl,
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
  }
});
