import { afterAll, expect, test } from 'bun:test';
import { createDatabase } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { emptyFieldValues, type WorkView } from '@anyko/contracts';
import { unzipSync, strFromU8 } from 'fflate';
import { randomBytes } from 'node:crypto';
import { createWorkRuntime } from '../../src/runtime/works/resources';
import { createWorkWorker } from '../../src/runtime/works/worker';
import { createDocumentWorker } from '../../src/runtime/documents/worker';
import type { SourceStorage } from '../../src/modules/documents';
import type { DocumentAgents } from '../../src/modules/agents';
import { LlmError } from '@anyko/llm';
import { createDocumentAgents } from '../../src/modules/agents/infrastructure/mastra';
import { createWorkProcessingStore } from '../../src/modules/processing/infrastructure/work-store';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/anyko_test')
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const testRedisUrl: string = redisUrl;
const db = createDatabase(databaseUrl);
const owned: string[] = [];
const files = new Map<string, Uint8Array>();
const storage: SourceStorage = {
  exists: (key) => Promise.resolve(files.has(key)),
  get: (key) => {
    const bytes = files.get(key);
    if (!bytes) throw new Error('MISSING_OBJECT');
    return Promise.resolve(bytes);
  },
  put: (key, bytes) => {
    files.set(key, bytes);
    return Promise.resolve();
  },
  delete: (key) => {
    files.delete(key);
    return Promise.resolve();
  },
};
const threads = new Set<string>();
let reconcileHook: DocumentAgents['reconcile'] | undefined;
let extractionCount = 0;
let failExtraction = false;
let failDocument: string | undefined;
let actualAgents: DocumentAgents | undefined;
let extractedName = 'Анна';
let imageFixture: { path: string; contentType: string; bytes: Uint8Array }[] =
  [];
let describeCount = 0;
let waitForVision: (() => Promise<void>) | undefined;
let waitForExtraction: (() => Promise<void>) | undefined;
const agents: DocumentAgents = {
  ready: () => Promise.resolve(),
  stop: () => Promise.resolve(),
  async reconcile(input) {
    if (actualAgents) return actualAgents.reconcile(input);
    threads.add(input.threadId);
    if (reconcileHook) return reconcileHook(input);
    return {
      summary: 'Сохранён контекст работы',
      candidates: [],
      usage: { inputTokens: 5, outputTokens: 3 },
    };
  },
  async describe(input) {
    describeCount++;
    if (actualAgents) return actualAgents.describe(input);
    await waitForVision?.();
    return {
      description: 'Белый шкаф с двумя дверцами.',
      usage: { inputTokens: 3, outputTokens: 4 },
    };
  },
  async extract(input) {
    if (actualAgents) return actualAgents.extract(input);
    extractionCount++;
    threads.add(input.threadId);
    await waitForExtraction?.();
    if (failExtraction || failDocument === input.document.id)
      throw new LlmError('LLM_RATE_LIMITED');
    return {
      candidates: [
        {
          field: 'personName',
          value: extractedName,
          evidence: [
            { documentId: input.document.id, imagePath: null, quote: 'Анна' },
          ],
        },
      ],
      usage: { inputTokens: 7, outputTokens: 9 },
    };
  },
  eraseThread: (id) => {
    if (actualAgents) return actualAgents.eraseThread(id);
    threads.delete(id);
    return Promise.resolve();
  },
};
const logger = createLogger({
  service: 'worker',
  environment: 'test',
  release: 'work-integration',
  level: 'error',
});
const options = {
  databaseUrl,
  encryptionKey: randomBytes(32).toString('hex'),
  storage,
  logger,
  agents,
};
const runtime = createWorkRuntime(options);
let worker: Awaited<ReturnType<typeof createWorkWorker>> | undefined;
let parser: Awaited<ReturnType<typeof createDocumentWorker>> | undefined;
async function ready() {
  if (worker) return;
  parser = await createDocumentWorker({
    databaseUrl: options.databaseUrl,
    redisUrl: testRedisUrl,
    storage,
    logger,
    queueName: `test-ocr-${crypto.randomUUID()}`,
    parser: {
      parseDocument: () =>
        Promise.resolve({
          markdown: 'Имя: Анна. Номер: 42.',
          processorVersion: 'fixture',
          images: imageFixture,
        }),
      eraseAttempt: () => Promise.resolve(),
    },
  });
  worker = await createWorkWorker({
    ...options,
    redisUrl: testRedisUrl,
    queueName: `test-work-${crypto.randomUUID()}`,
  });
}
async function create() {
  await ready();
  const workspaceId = crypto.randomUUID();
  owned.push(workspaceId);
  await db.anykoWorkspace.create({
    data: { id: workspaceId, name: 'Synthetic works' },
  });
  await runtime.saveSettings(workspaceId, {
    baseURL: 'http://127.0.0.1:1/v1',
    visionModel: 'fixture',
    extractionModel: 'fixture',
    apiKey: crypto.randomUUID(),
  });
  const view = await runtime.api.create({
    workspaceId,
    actorId: 'fixture',
    packageVersion: 'technical-document-v1',
    title: 'Тестовая работа',
  });
  return { workspaceId, workId: view.work.id };
}
async function until(
  input: { workspaceId: string; workId: string },
  predicate: (view: WorkView) => boolean,
) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const view = await runtime.api.get(input.workspaceId, input.workId);
    if (predicate(view)) return view;
    await Bun.sleep(30);
  }
  throw new Error('WORK_STATUS_TIMEOUT');
}
const terminal = (view: WorkView) =>
  !!view.runs.length &&
  view.runs.every((run) => !['queued', 'running'].includes(run.status));
async function upload(input: { workspaceId: string; workId: string }) {
  return runtime.api.upload({
    ...input,
    actorId: 'fixture',
    filename: 'fixture.pdf',
    bytes: new TextEncoder().encode('%PDF-1.7\n synthetic'),
    correlationId: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
  });
}
const analyze = (input: { workspaceId: string; workId: string }) =>
  runtime.api.analyze({
    ...input,
    actorId: 'fixture',
    correlationId: crypto.randomUUID(),
  });
async function rejects(operation: Promise<unknown>, code: string) {
  let failure: unknown;
  try {
    await operation;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure instanceof Error ? failure.message : '').toContain(code);
}

afterAll(async () => {
  await worker?.stop();
  await parser?.stop();
  await runtime.stop();
  const where = { workspaceId: { in: owned } };
  await db.workIo.deleteMany({ where });
  await db.workArtifact.deleteMany({ where });
  await db.workAgentThread.deleteMany({ where });
  await db.work.deleteMany({ where });
  await db.llmSettings.deleteMany({ where });
  await db.documentIo.deleteMany({ where });
  await db.documentArtifact.deleteMany({ where });
  await db.processorAttempt.deleteMany({ where });
  await db.documentDeletion.deleteMany({ where });
  await db.sourceUpload.deleteMany({ where });
  await db.resultUpload.deleteMany({ where });
  await db.processingRun.deleteMany({ where });
  await db.sourceDocument.deleteMany({ where });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
});

test('persistent pipeline extracts facts, caches successful files, generates saved DOCX and denies foreign scope', async () => {
  const input = await create();
  const doc = await upload(input);
  await analyze(input);
  const view = await until(input, terminal);
  expect(view.runs[0]?.status).toBe('succeeded');
  expect(view.facts.values.personName).toBe('Анна');
  const count = extractionCount;
  await analyze(input);
  await until(input, terminal);
  expect(extractionCount).toBe(count);
  const reopened = await runtime.api.get(input.workspaceId, input.workId);
  expect(
    (await runtime.api.events(input.workspaceId, input.workId, '0')).length,
  ).toBeGreaterThan(2);
  await rejects(
    runtime.api.get(crypto.randomUUID(), input.workId),
    'NOT_FOUND',
  );
  await runtime.api.generate({
    ...input,
    actorId: 'fixture',
    correlationId: crypto.randomUUID(),
    revision: reopened.work.revision,
  });
  const generated = await until(input, (state) =>
    state.generations.some((item) => item.status === 'succeeded'),
  );
  const id = generated.generations[0]?.id;
  if (!id) throw new Error('MISSING_GENERATION');
  const bytes = (
    await runtime.api.download(input.workspaceId, input.workId, id)
  ).bytes;
  const xml = unzipSync(bytes)['word/document.xml'];
  if (!xml) throw new Error('MISSING_DOCUMENT_XML');
  expect(strFromU8(xml)).toContain('Анна');
  expect(strFromU8(xml)).not.toContain('{personName}');
  const threadIds = await runtime.deps.processing.threads(
    input.workspaceId,
    input.workId,
  );
  await runtime.deps.documents.remove({
    workspaceId: input.workspaceId,
    documentId: doc.id,
  });
  const hidden = await runtime.api.get(input.workspaceId, input.workId);
  expect(hidden.facts.candidates).toEqual([]);
  expect(hidden.generations).toEqual([]);
  await until(
    input,
    (state) => !state.cleanupPending && !state.documents.length,
  );
  expect(
    await db.workAgentThread.count({ where: { workId: input.workId } }),
  ).toBe(0);
  expect(threadIds.every((id) => !threads.has(id))).toBe(true);
  expect(await db.workFacts.count({ where: { workId: input.workId } })).toBe(0);
  expect(
    [...files.keys()].some((key) =>
      key.includes(`generated/${input.workspaceId}/`),
    ),
  ).toBe(false);
});

test('a package generates three individually scoped DOCX files from one snapshot and source deletion erases the whole set', async () => {
  const legacy = await create();
  const created = await runtime.api.create({
    workspaceId: legacy.workspaceId,
    actorId: 'fixture',
    packageVersion: 'bfl-bankruptcy-v3',
    title: 'Синтетический комплект',
  });
  const input = { workspaceId: legacy.workspaceId, workId: created.work.id };
  const doc = await upload(input);
  const uploaded = await runtime.api.get(input.workspaceId, input.workId);
  const saved = await runtime.api.edit({
    ...input,
    revision: uploaded.work.revision,
    values: {
      ...created.facts.values,
      lastName: 'Тестовый',
      firstName: 'Пётр',
      middleName: 'Сергеевич',
      debts: [
        { name: 'Банк А', basis: 'Договор А', amount: '100.00' },
        { name: 'Банк Б', basis: 'Договор Б', amount: '200.00' },
      ],
      requestsDetails: 'Ввести процедуру реструктуризации долгов',
    },
  });
  await runtime.api.generate({
    ...input,
    actorId: 'fixture',
    correlationId: crypto.randomUUID(),
    revision: saved.work.revision,
  });
  const completed = await until(input, (state) =>
    state.generations.some((generation) => generation.status === 'succeeded'),
  );
  const generation = completed.generations[0];
  if (!generation) throw new Error('MISSING_GENERATION');
  expect(generation.files).toHaveLength(3);
  for (const file of generation.files) {
    expect(file.status).toBe('succeeded');
    const output = await runtime.api.download(
      input.workspaceId,
      input.workId,
      generation.id,
      file.id,
    );
    const xml = strFromU8(
      unzipSync(output.bytes)['word/document.xml'] ?? new Uint8Array(),
    );
    expect(xml).toContain('Тестовый');
    expect(xml).toContain('Пётр');
    expect(xml).not.toMatch(/\{[#/a-zA-Z][^}]*\}/);
    await rejects(
      runtime.api.download(
        crypto.randomUUID(),
        input.workId,
        generation.id,
        file.id,
      ),
      'NOT_FOUND',
    );
  }
  await rejects(
    runtime.api.download(
      input.workspaceId,
      input.workId,
      generation.id,
      crypto.randomUUID(),
    ),
    'NOT_FOUND',
  );
  await runtime.api.removeDocument({ ...input, documentId: doc.id });
  await until(
    input,
    (state) => !state.cleanupPending && !state.documents.length,
  );
  expect(
    await db.workGenerationFile.count({
      where: { workspaceId: input.workspaceId, workId: input.workId },
    }),
  ).toBe(0);
  expect(
    [...files.keys()].some((key) =>
      key.includes(`generated/${input.workspaceId}/${input.workId}/`),
    ),
  ).toBe(false);
});

test('manual edits during model execution survive; optimistic revision rejects stale saves', async () => {
  const input = await create();
  await upload(input);
  let release: () => void = () => {};
  let started: () => void = () => {};
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  waitForExtraction = () => {
    started();
    return barrier;
  };
  try {
    await analyze(input);
    await entered;
    const view = await runtime.api.get(input.workspaceId, input.workId);
    await runtime.api.edit({
      ...input,
      revision: view.work.revision,
      values: { ...emptyFieldValues(), personName: 'Ручное значение' },
    });
    await rejects(
      runtime.api.edit({
        ...input,
        revision: view.work.revision,
        values: emptyFieldValues(),
      }),
      'REVISION_CONFLICT',
    );
    release();
    expect((await until(input, terminal)).facts.values.personName).toBe(
      'Ручное значение',
    );
  } finally {
    release();
    waitForExtraction = undefined;
  }
});

test('provider failure is persisted and a user retry can recover without losing the work', async () => {
  const input = await create();
  await upload(input);
  failExtraction = true;
  try {
    await analyze(input);
    const view = await until(input, terminal);
    expect(view.runs[0]?.status).toBe('failed');
    expect(
      view.runs[0]?.steps.some((step) => step.errorCode === 'LLM_RATE_LIMITED'),
    ).toBe(true);
  } finally {
    failExtraction = false;
  }
  await analyze(input);
  expect((await until(input, terminal)).facts.values.personName).toBe('Анна');
});

test('a failed file does not stop another file; retry reuses the successful extraction', async () => {
  const input = await create();
  const first = await upload(input);
  await upload(input);
  failDocument = first.id;
  try {
    await analyze(input);
    const state = await until(input, terminal);
    expect(state.runs[0]?.status).toBe('partial');
    expect(state.facts.values.personName).toBe('Анна');
  } finally {
    failDocument = undefined;
  }
  const before = extractionCount;
  await analyze(input);
  expect((await until(input, terminal)).runs[0]?.status).toBe('succeeded');
  expect(extractionCount - before).toBe(1);
});

test('deletion during model execution hides derivatives immediately and fences the late reply', async () => {
  const input = await create();
  const doc = await upload(input);
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  waitForExtraction = () => {
    entered();
    return barrier;
  };
  try {
    await analyze(input);
    await started;
    await runtime.api.removeDocument({ ...input, documentId: doc.id });
    const hidden = await runtime.api.get(input.workspaceId, input.workId);
    expect(hidden.cleanupPending).toBe(true);
    expect(hidden.facts.candidates).toEqual([]);
    expect(await db.workIo.count({ where: { workId: input.workId } })).toBe(1);
    release();
    const clean = await until(
      input,
      (state) => !state.cleanupPending && !state.documents.length,
    );
    expect(clean.facts.values).toEqual(emptyFieldValues());
    expect(await db.workRun.count({ where: { workId: input.workId } })).toBe(0);
    expect(
      await db.workAgentThread.count({ where: { workId: input.workId } }),
    ).toBe(0);
  } finally {
    release();
    waitForExtraction = undefined;
  }
});

test('lease recovery atomically reopens the outbox and rejects a superseded attempt', async () => {
  const input = await create();
  const runId = crypto.randomUUID();
  await runtime.deps.locks.run(
    `work-run:${input.workspaceId}:${runId}`,
    async () => {
      await runtime.deps.processing.start({
        ...input,
        id: runId,
        actorId: 'fixture',
        kind: 'analysis',
        inputRevision: 0,
        documentIds: [],
        settingsRevision: 1,
        generationId: null,
        correlationId: crypto.randomUUID(),
        attemptToken: null,
        modelSnapshot: { vision: 'fixture', extraction: 'fixture' },
      });
      const old = await runtime.deps.processing.claim(input.workspaceId, runId);
      if (!old) throw new Error('CLAIM_MISSING');
      await db.workOutbox.update({
        where: { runId },
        data: { deliveredAt: new Date() },
      });
      await db.workRun.update({
        where: { id: runId },
        data: { leaseUntil: new Date(0) },
      });
      await runtime.deps.processing.reconcile();
      expect(
        (await db.workOutbox.findUniqueOrThrow({ where: { runId } }))
          .deliveredAt,
      ).toBeNull();
      const fresh = await runtime.deps.processing.claim(
        input.workspaceId,
        runId,
      );
      if (!fresh) throw new Error('RECLAIM_MISSING');
      expect(await runtime.deps.processing.valid(old)).toBe(false);
      await runtime.deps.processing.finish(old, 'succeeded');
      expect(await runtime.deps.processing.valid(fresh)).toBe(true);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL TIME ZONE 'Europe/Moscow'`;
        await createWorkProcessingStore(tx).reconcile();
        expect(await createWorkProcessingStore(tx).valid(fresh)).toBe(true);
      });
      await rejects(
        runtime.deps.processing.step(old, {
          stage: 'extraction',
          status: 'succeeded',
        }),
        'STALE_WORK_ATTEMPT',
      );
      await runtime.deps.processing.finish(fresh, 'cancelled');
    },
  );
});

test('confirmation survives added sources and repeated analysis; only the new file calls the model', async () => {
  const input = await create();
  await upload(input);
  await analyze(input);
  const initial = await until(input, terminal);
  await runtime.api.confirm({ ...input, revision: initial.work.revision });
  const before = extractionCount;
  extractedName = 'Ирина';
  try {
    await upload(input);
    await analyze(input);
    const changed = await until(input, terminal);
    expect(changed.facts.values.personName).toBe('Анна');
    expect(changed.work.confirmedRevision).toBeNull();
    expect(extractionCount - before).toBe(1);
    await analyze(input);
    expect((await until(input, terminal)).facts.values.personName).toBe('Анна');
    expect(extractionCount - before).toBe(1);
  } finally {
    extractedName = 'Анна';
  }
});

test('all works remain reachable across stable cursor pages', async () => {
  const input = await create();
  await db.work.createMany({
    data: Array.from({ length: 103 }, (_, index) => ({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      title: `Работа ${String(index)}`,
      packageVersion: 'technical-document-v1',
      createdBy: 'fixture',
    })),
  });
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await runtime.api.list(input.workspaceId, cursor);
    seen.push(...page.works.map((work) => work.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(seen).toHaveLength(104);
  expect(new Set(seen).size).toBe(104);
});

const fixtureImage = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
);
test('deletion during the first visual prevents a second provider request', async () => {
  const input = await create();
  let release: () => void = () => {},
    entered: () => void = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  imageFixture = [1, 2].map((index) => ({
    path: `images/picture-${String(index)}.png`,
    contentType: 'image/png',
    bytes: fixtureImage,
  }));
  waitForVision = () => {
    entered();
    return barrier;
  };
  const before = describeCount;
  try {
    const doc = await upload(input);
    await analyze(input);
    await started;
    await runtime.api.removeDocument({ ...input, documentId: doc.id });
    release();
    await until(
      input,
      (state) => !state.cleanupPending && !state.documents.length,
    );
    expect(describeCount - before).toBe(1);
  } finally {
    release();
    waitForVision = undefined;
    imageFixture = [];
  }
});

test('actual Mastra uses image/tool/structured SDK protocol and cleanup erases its persisted messages', async () => {
  const input = await create();
  let documentId = '';
  let sawImage = false,
    sawTool = false,
    sawStructured = false;
  const requestSchema = z.object({
    stream: z.boolean().optional(),
    model: z.string(),
    response_format: z.unknown().optional(),
    tools: z
      .array(z.object({ function: z.object({ name: z.string() }) }))
      .optional(),
    messages: z.array(
      z.object({ role: z.string(), content: z.unknown().optional() }),
    ),
  });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const value: unknown = await request.json();
      const body = requestSchema.parse(value);
      const coordinator = JSON.stringify(body.messages).includes(
        'documents.analyzed',
      );
      const visual = JSON.stringify(body.messages).includes('image_url');
      sawImage ||= visual;
      sawStructured ||= body.response_format !== undefined;
      const toolName =
        !coordinator &&
        !visual &&
        !body.messages.some((message) => message.role === 'tool')
          ? body.tools?.[0]?.function.name
          : undefined;
      sawTool ||= body.messages.some((message) => message.role === 'tool');
      const text = JSON.stringify(
        coordinator
          ? { summary: 'Сохранён контекст SDK', candidates: [] }
          : visual
            ? { description: 'Белый шкаф.' }
            : {
                candidates: [
                  {
                    field: 'personName',
                    value: 'Анна',
                    evidence: [{ documentId, imagePath: null, quote: 'Анна' }],
                  },
                ],
              },
      );
      const calls = toolName
        ? [
            {
              id: 'call_fixture',
              type: 'function',
              function: { name: toolName, arguments: '{"offset":0}' },
            },
          ]
        : undefined;
      const finish = toolName ? 'tool_calls' : 'stop';
      if (!body.stream)
        return Response.json({
          id: 'fixture',
          model: body.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: toolName ? null : text,
                ...(calls ? { tool_calls: calls } : {}),
              },
              finish_reason: finish,
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      const chunks = [
        {
          id: 'fixture',
          model: body.model,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                ...(calls
                  ? { tool_calls: calls.map((call) => ({ index: 0, ...call })) }
                  : { content: text }),
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'fixture',
          model: body.model,
          choices: [{ index: 0, delta: {}, finish_reason: finish }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];
      return new Response(
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
          'data: [DONE]\n\n',
        { headers: { 'content-type': 'text/event-stream' } },
      );
    },
  });
  actualAgents = createDocumentAgents({
    databaseUrl: options.databaseUrl,
    timeoutMs: 5000,
  });
  const inspection = new PostgresStore({
    id: 'test-inspection',
    connectionString: options.databaseUrl,
    schemaName: 'anyko_agents',
  });
  let threadIds: string[] = [];
  try {
    await actualAgents.ready();
    await inspection.init();
    await runtime.saveSettings(input.workspaceId, {
      baseURL: `http://127.0.0.1:${String(server.port)}/v1`,
      visionModel: 'fixture',
      extractionModel: 'fixture',
      apiKey: crypto.randomUUID(),
    });
    imageFixture = [
      {
        path: 'images/picture.png',
        contentType: 'image/png',
        bytes: fixtureImage,
      },
    ];
    const doc = await upload(input);
    documentId = doc.id;
    await analyze(input);
    const state = await until(input, terminal);
    expect(state.runs[0]?.status).toBe('succeeded');
    expect(state.facts.values.personName).toBe('Анна');
    expect(sawImage).toBe(true);
    expect(sawTool).toBe(true);
    expect(sawStructured).toBe(true);
    const vision = await db.workStep.findFirstOrThrow({
      where: { run: { workId: input.workId }, stage: 'vision' },
    });
    expect(vision.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    threadIds = await runtime.deps.processing.threads(
      input.workspaceId,
      input.workId,
    );
    const memory = await inspection.getStore('memory');
    if (!memory || !threadIds[0]) throw new Error('MISSING_MEMORY_FIXTURE');
    expect(
      (await memory.listMessages({ threadId: threadIds[0] })).messages.length,
    ).toBeGreaterThan(0);
    await runtime.api.removeDocument({ ...input, documentId: doc.id });
    await until(
      input,
      (view) => !view.cleanupPending && !view.documents.length,
    );
    for (const threadId of threadIds) {
      expect(await memory.getThreadById({ threadId })).toBeNull();
      expect((await memory.listMessages({ threadId })).messages).toEqual([]);
    }
  } finally {
    for (const id of threadIds) await actualAgents.eraseThread(id);
    await actualAgents.stop();
    actualAgents = undefined;
    imageFixture = [];
    await inspection.close();
    await server.stop(true);
  }
});

test('logical session survives reopening, extends context with a new source, and keeps extraction cached', async () => {
  const input = await create();
  const first = await upload(input);
  await analyze(input);
  const initial = await until(input, terminal);
  const sessionId = initial.session?.id;
  if (!sessionId) throw Error('Expected saved session');
  expect(initial.session?.revision).toBe(1);
  const reopened = createWorkRuntime(options);
  try {
    expect(
      (await reopened.api.get(input.workspaceId, input.workId)).session?.id,
    ).toBe(sessionId);
  } finally {
    await reopened.stop();
  }
  const previousCalls = extractionCount;
  const second = await upload(input);
  reconcileHook = async (request) => {
    expect(request.sessionId).toBe(sessionId);
    expect(request.previousContext?.summary).toBe('Сохранён контекст работы');
    expect(request.documents.map((d) => d.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(await request.readSource(second.id, null)).toContain('42');
    await rejects(
      request.readSource(crypto.randomUUID(), null),
      'SOURCE_NOT_ALLOWED',
    );
    return {
      summary: 'Новый документ дополнил сохранённый контекст',
      candidates: [
        {
          origin: 'context',
          field: 'documentNumber',
          value: '42',
          evidence: [{ documentId: second.id, imagePath: null, quote: '42' }],
        },
      ],
      usage: { inputTokens: 2, outputTokens: 3 },
    };
  };
  try {
    await analyze(input);
    const next = await until(input, terminal);
    expect(next.session?.id).toBe(sessionId);
    expect(next.session?.revision).toBe(2);
    expect(next.session?.context?.summary).toContain('Новый документ');
    expect(next.facts.values.documentNumber).toBe('42');
    expect(next.facts.candidates.some((c) => c.origin === 'context')).toBe(
      true,
    );
    expect(extractionCount - previousCalls).toBe(1);
    expect(
      await db.workAgentTurn.count({ where: { workId: input.workId } }),
    ).toBe(2);
  } finally {
    reconcileHook = undefined;
  }
});

test('failed context continuation preserves previous facts and marks its old summary stale', async () => {
  const input = await create();
  await upload(input);
  await analyze(input);
  const before = await until(input, terminal);
  reconcileHook = () => Promise.reject(new LlmError('LLM_UNAVAILABLE'));
  try {
    await upload(input);
    await analyze(input);
    const next = await until(input, terminal);
    expect(next.runs[0]?.status).toBe('partial');
    expect(next.facts.values.personName).toBe('Анна');
    expect(next.session?.revision).toBe(before.session?.revision);
    expect(next.session?.context?.workRevision).not.toBe(next.work.revision);
  } finally {
    reconcileHook = undefined;
  }
});

test('manual edit during contextual reasoning retries from fresh facts and fences the stale summary', async () => {
  const input = await create();
  await upload(input);
  let calls = 0;
  reconcileHook = async (request) => {
    calls++;
    if (calls === 1) {
      const state = await runtime.api.get(input.workspaceId, input.workId);
      await runtime.api.edit({
        ...input,
        revision: state.work.revision,
        values: { ...state.facts.values, personName: 'Ручное имя' },
      });
    } else expect(request.facts.values.personName).toBe('Ручное имя');
    return {
      summary:
        calls === 1 ? 'Устаревшая сводка' : 'Сводка с актуальным решением',
      candidates: [],
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
  try {
    await analyze(input);
    const state = await until(input, terminal);
    expect(calls).toBe(2);
    expect(state.facts.values.personName).toBe('Ручное имя');
    expect(state.session?.context?.summary).toBe(
      'Сводка с актуальным решением',
    );
    expect(
      await db.workAgentTurn.count({ where: { workId: input.workId } }),
    ).toBe(1);
  } finally {
    reconcileHook = undefined;
  }
});

test('deleting during contextual reasoning removes its session, turns, and all registered threads', async () => {
  const input = await create();
  const doc = await upload(input);
  let release = () => {};
  let signalStarted = () => {};
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  reconcileHook = async () => {
    signalStarted();
    await held;
    return {
      summary: 'Ответ удалённого исходника',
      candidates: [],
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
  try {
    await analyze(input);
    await started;
    await runtime.api.removeDocument({ ...input, documentId: doc.id });
    release();
    const state = await until(
      input,
      (s) => !s.cleanupPending && !s.documents.length,
    );
    expect(state.session).toBeNull();
    expect(
      await db.workAgentSession.count({ where: { workId: input.workId } }),
    ).toBe(0);
    expect(
      await db.workAgentTurn.count({ where: { workId: input.workId } }),
    ).toBe(0);
    expect(
      await runtime.deps.processing.threads(input.workspaceId, input.workId),
    ).toEqual([]);
  } finally {
    release();
    reconcileHook = undefined;
  }
});

test('superseded attempt cannot commit a session checkpoint or facts', async () => {
  const input = await create();
  const runId = crypto.randomUUID();
  await runtime.deps.processing.start({
    id: runId,
    ...input,
    kind: 'analysis',
    inputRevision: 0,
    documentIds: [],
    settingsRevision: 1,
    generationId: null,
    correlationId: crypto.randomUUID(),
    attemptToken: null,
    actorId: 'fixture',
    modelSnapshot: { vision: 'fixture', extraction: 'fixture' },
  });
  const old = await runtime.deps.processing.claim(input.workspaceId, runId);
  if (!old) throw Error('claim');
  await db.workRun.update({
    where: { id: runId },
    data: { attemptToken: crypto.randomUUID() },
  });
  await rejects(
    runtime.deps.transaction(async (stores) => {
      await stores.processing.fence(old);
      await stores.works.touch(input.workspaceId, input.workId, {});
    }),
    'STALE_WORK_ATTEMPT',
  );
  expect(
    (await runtime.api.get(input.workspaceId, input.workId)).work.revision,
  ).toBe(0);
});
