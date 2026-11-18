import { afterAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';

import { PostgresStore } from '@mastra/pg';
import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import { rightCatalog } from '@anyko/backend/scope';
import { createDatabase, createDatabasePool } from '@anyko/database';
import { LlmError } from '@anyko/llm';
import { createLogger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';

import { createApp } from '../../../apps/api/src/http/app';
import type { DocumentAgents } from '../../../packages/backend/src/modules/agents';
import { createDocumentAgents } from '../../../packages/backend/src/modules/agents/infrastructure/mastra';
import type {
  DocumentParser,
  SourceStorage,
} from '../../../packages/backend/src/modules/documents';
import { createWorkProcessingStore } from '../../../packages/backend/src/modules/processing/infrastructure/work-store';
import {
  brandDocumentId,
  brandFileId,
  brandGenerationId,
  brandWorkId,
} from '../../../packages/backend/src/platform/ids';
import { emptyFieldValues } from '../../../packages/backend/src/profiles/bfl/fields';
import { createBackend } from '../../../packages/backend/src/runtime';
import { memberScope } from '../../../packages/backend/tests/support/scope';

import { integrationConfig } from './support/composition';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
)
  throw new Error(
    'Dedicated anyko_test or anyko_test_<worktree> TEST_DATABASE_URL required',
  );
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const testRedisUrl: string = redisUrl;
type WorkView = Awaited<ReturnType<typeof apiBackend.workHttp.views.get>>;
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
// Read-side adapters the processing assertions use directly, on the same database.
const workProcessing = createWorkProcessingStore(db);
const actualPool = createDatabasePool(databaseUrl);
const owned: string[] = [];
const files = new Map<string, Uint8Array>();
let pauseGeneratedWrite: (() => Promise<void>) | undefined;
let pauseOcr: (() => Promise<void>) | undefined;
const storage: SourceStorage = {
  exists: (key) => Promise.resolve(files.has(key)),
  get: (key) => {
    const bytes = files.get(key);
    if (!bytes) throw new Error('MISSING_OBJECT');
    return Promise.resolve(bytes);
  },
  put: async (key, bytes) => {
    if (key.startsWith('generated/')) await pauseGeneratedWrite?.();
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
let extractionModel: string | undefined;
let waitForExtraction: (() => Promise<void>) | undefined;
let extractFixture: DocumentAgents['extract'] | undefined;
let parseFixture: DocumentParser['parseDocument'] | undefined;
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
    if (extractFixture) return extractFixture(input);
    extractionCount++;
    extractionModel = input.modelId;
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
// Same composition as the processes: an API backend and a worker backend over one database.
const testConfig = integrationConfig({
  databaseUrl,
  redisUrl: testRedisUrl,
  encryptionKey: randomBytes(32).toString('hex'),
});
const apiBackend = createBackend(testConfig, {
  logger,
  role: 'api',
  dependencies: { storage, agents },
});
const runtime = {
  saveSettings: (
    workspaceId: string,
    input: Parameters<typeof apiBackend.workHttp.settings.save>[1],
  ) => apiBackend.workHttp.settings.save(memberScope(workspaceId), input),
  deps: { documents: apiBackend.documentHttp.documents },
  stop: () => apiBackend.stop(),
};
const workerBackend = createBackend(testConfig, {
  logger,
  role: 'worker',
  dependencies: {
    storage,
    agents,
    parser: {
      parseDocument: async (...args) => {
        if (parseFixture) return parseFixture(...args);
        await pauseOcr?.();
        return {
          markdown: 'Имя: Анна. Номер: 42.',
          processorVersion: 'fixture',
          images: imageFixture,
        };
      },
      eraseAttempt: () => Promise.resolve(),
    },
  },
});
let worker: Awaited<ReturnType<typeof startJobWorker>> | undefined;
async function ready() {
  if (worker) return;
  await workerBackend.ready();
  worker = await startJobWorker(workerBackend.jobs, {
    prefix: `test-work-${crypto.randomUUID()}`,
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
  const workId = await apiBackend.workHttp.intake.createWork(
    memberScope(workspaceId, 'fixture'),
    { packageVersion: 'technical-document-v1', title: 'Тестовая работа' },
  );
  return { workspaceId, workId };
}
async function until(
  input: { workspaceId: string; workId: string },
  predicate: (view: WorkView) => boolean,
) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const view = await apiBackend.workHttp.views.get(
      memberScope(input.workspaceId),
      brandWorkId(input.workId),
    );
    if (predicate(view)) return view;
    await Bun.sleep(30);
  }
  throw new Error('WORK_STATUS_TIMEOUT');
}
const terminal = (view: WorkView) =>
  !!view.runs.length &&
  view.runs.every((run) => !['queued', 'running'].includes(run.status));

test('reprocesses an older PDF, traces its quote to the page and renders only the supported value', async () => {
  const input = await create();
  const name = 'Тестова Мария';
  const inventedDate = '2026-08-19';
  const original = 'Заявитель: ' + name;
  const scope = memberScope(input.workspaceId);
  parseFixture = () =>
    Promise.resolve({
      markdown: '1, 26.2',
      processorVersion: 'mineru-4.1.7',
    });
  try {
    const document = await upload(input);
    await until(input, (view) =>
      view.documents.some(
        (doc) =>
          doc.id === document.id && doc.errorCode === 'OCR_RETRY_REQUIRED',
      ),
    );
    await rejects(
      apiBackend.workHttp.views.result(
        scope,
        brandWorkId(input.workId),
        brandDocumentId(document.id),
      ),
      'NOT_READY',
    );
    parseFixture = () =>
      Promise.resolve({
        markdown: '## Страница 2\n\n' + original + '\n\nДата:',
        processorVersion: 'mineru-4.1.7+eslav.1',
        pdfOcr: {
          version: 1,
          pages: [
            {
              page: 2,
              omittedLines: 1,
              lines: [
                {
                  text: original,
                  bbox: [0.1, 0.2, 0.8, 0.25],
                  confidence: 0.95,
                },
              ],
            },
          ],
        },
      });
    extractFixture = ({ document }) => {
      expect(document.text).toContain(original);
      const evidence = [
        { documentId: document.id, imagePath: null, quote: original },
      ];
      return Promise.resolve({
        candidates: [
          { field: 'personName', value: name, evidence },
          { field: 'documentDate', value: inventedDate, evidence },
        ],
        usage: { inputTokens: null, outputTokens: null },
      });
    };
    await analyze(input);
    const view = await until(input, terminal);
    expect(view.documents[0]?.status).toBe('succeeded');
    expect(view.facts.values.personName).toBe(name);
    expect(view.facts.values.documentDate).toBeNull();
    expect(
      view.facts.candidates.find((item) => item.field === 'personName')
        ?.evidence[0]?.page,
    ).toBe(2);
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId: brandWorkId(input.workId),
      revision: view.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const generated = await until(input, (state) =>
      state.generations.some((item) => item.status === 'succeeded'),
    );
    const generation = generated.generations[0];
    if (!generation) throw new Error('MISSING_GENERATION');
    const { bytes } = await apiBackend.workHttp.generation.downloadResult(
      scope,
      {
        workId: brandWorkId(input.workId),
        generationId: brandGenerationId(generation.id),
      },
    );
    const xml = unzipSync(bytes)['word/document.xml'];
    if (!xml) throw new Error('MISSING_DOCUMENT_XML');
    expect(strFromU8(xml)).toContain(name);
    expect(strFromU8(xml)).not.toContain(inventedDate);
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
});
async function upload(input: { workspaceId: string; workId: string }) {
  return apiBackend.workHttp.intake.uploadDocument(
    memberScope(input.workspaceId, 'fixture'),
    {
      workId: brandWorkId(input.workId),
      filename: 'fixture.pdf',
      bytes: new TextEncoder().encode('%PDF-1.7\n synthetic'),
      correlationId: crypto.randomUUID(),
      requestKey: crypto.randomUUID(),
    },
  );
}
const analyze = (input: { workspaceId: string; workId: string }) =>
  apiBackend.workHttp.intake.analyzeWork(
    memberScope(input.workspaceId, 'fixture'),
    { workId: brandWorkId(input.workId), correlationId: crypto.randomUUID() },
  );
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
  await workerBackend.stop();
  await runtime.stop();
  const where = { workspaceId: { in: owned } };
  await db.processingIo.deleteMany({ where });
  await db.workArtifact.deleteMany({ where });
  await db.workAgentThread.deleteMany({ where });
  await db.work.deleteMany({ where });
  await db.workDeletion.deleteMany({ where });
  await db.idempotencyKey.deleteMany({ where });
  await db.llmSettings.deleteMany({ where });
  await db.processingIo.deleteMany({ where });
  await db.documentArtifact.deleteMany({ where });
  await db.runAttempt.deleteMany({ where });
  await db.documentDeletion.deleteMany({ where });
  await db.sourceUpload.deleteMany({ where });
  await db.resultUpload.deleteMany({ where });
  await db.run.deleteMany({ where });
  await db.sourceDocument.deleteMany({ where });
  await db.auditEvent.deleteMany({ where: { workspaceId: { in: owned } } });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
  await pool.end();
  await actualPool.end();
});

test('persistent pipeline extracts facts, caches successful files, generates saved DOCX and denies foreign scope', async () => {
  const input = await create();
  const doc = await upload(input);
  await analyze(input);
  const view = await until(input, terminal);
  expect(view.runs[0]?.status).toBe('succeeded');
  expect(view.facts.values.personName).toBe('Анна');
  // Результат исходного документа работы содержит распознанный текст.
  const documentResult = await apiBackend.workHttp.views.result(
    memberScope(input.workspaceId),
    brandWorkId(input.workId),
    brandDocumentId(doc.id),
  );
  expect(documentResult.markdown).toBe('Имя: Анна. Номер: 42.');
  const count = extractionCount;
  await analyze(input);
  await until(input, terminal);
  expect(extractionCount).toBe(count);
  const reopened = await apiBackend.workHttp.views.get(
    memberScope(input.workspaceId),
    brandWorkId(input.workId),
  );
  expect(
    (
      await apiBackend.workHttp.works.queries.events(
        memberScope(input.workspaceId),
        brandWorkId(input.workId),
        '0',
      )
    ).length,
  ).toBeGreaterThan(2);
  await rejects(
    apiBackend.workHttp.views.get(
      memberScope(crypto.randomUUID()),
      brandWorkId(input.workId),
    ),
    'NOT_FOUND',
  );
  await apiBackend.workHttp.generation.startGeneration(
    memberScope(input.workspaceId, 'fixture'),
    {
      workId: brandWorkId(input.workId),
      revision: reopened.work.revision,
      correlationId: crypto.randomUUID(),
    },
  );
  const generated = await until(input, (state) =>
    state.generations.some((item) => item.status === 'succeeded'),
  );
  const id = generated.generations[0]?.id;
  if (!id) throw new Error('MISSING_GENERATION');
  const generationRun = await db.run.findFirstOrThrow({
    where: { workspaceId: input.workspaceId, generationId: id },
    select: { settingsRevision: true },
  });
  expect(generationRun.settingsRevision).toBe(1);

  // Запуск генерации пишет событие журнала в той же транзакции, что и постановку.
  expect(
    await db.auditEvent.findMany({
      where: { workspaceId: input.workspaceId, action: 'generation.started' },
      select: { actorId: true, targetKind: true, targetId: true },
    }),
  ).toEqual([{ actorId: 'fixture', targetKind: 'generation', targetId: id }]);
  const bytes = (
    await apiBackend.workHttp.generation.downloadResult(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        generationId: brandGenerationId(id),
      },
    )
  ).bytes;
  const xml = unzipSync(bytes)['word/document.xml'];
  if (!xml) throw new Error('MISSING_DOCUMENT_XML');
  expect(strFromU8(xml)).toContain('Анна');
  expect(strFromU8(xml)).not.toContain('{personName}');
  const threadIds = await workProcessing.threads(
    input.workspaceId,
    input.workId,
  );
  await runtime.deps.documents.commands.remove(
    memberScope(input.workspaceId),
    brandDocumentId(doc.id),
  );
  const hidden = await apiBackend.workHttp.views.get(
    memberScope(input.workspaceId),
    brandWorkId(input.workId),
  );
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
  const createdId = await apiBackend.workHttp.intake.createWork(
    memberScope(legacy.workspaceId, 'fixture'),
    { packageVersion: 'bfl-bankruptcy-v3', title: 'Синтетический комплект' },
  );
  const created = await apiBackend.workHttp.views.get(
    memberScope(legacy.workspaceId),
    createdId,
  );
  const input = { workspaceId: legacy.workspaceId, workId: createdId };
  const doc = await upload(input);
  const uploaded = await apiBackend.workHttp.views.get(
    memberScope(input.workspaceId),
    brandWorkId(input.workId),
  );
  await apiBackend.workHttp.review.editValues(memberScope(input.workspaceId), {
    workId: brandWorkId(input.workId),
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
  const saved = await apiBackend.workHttp.views.get(
    memberScope(input.workspaceId),
    brandWorkId(input.workId),
  );
  await apiBackend.workHttp.generation.startGeneration(
    memberScope(input.workspaceId, 'fixture'),
    {
      workId: brandWorkId(input.workId),
      revision: saved.work.revision,
      correlationId: crypto.randomUUID(),
    },
  );
  const completed = await until(input, (state) =>
    state.generations.some((generation) => generation.status === 'succeeded'),
  );
  const generation = completed.generations[0];
  if (!generation) throw new Error('MISSING_GENERATION');
  expect(generation.files).toHaveLength(3);
  for (const file of generation.files) {
    expect(file.status).toBe('succeeded');
    const output = await apiBackend.workHttp.generation.downloadResult(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        generationId: brandGenerationId(generation.id),
        fileId: brandFileId(file.id),
      },
    );
    const xml = strFromU8(
      unzipSync(output.bytes)['word/document.xml'] ?? new Uint8Array(),
    );
    expect(xml).toContain('Тестовый');
    expect(xml).toContain('Пётр');
    expect(xml).not.toMatch(/\{[#/a-zA-Z][^}]*\}/);
    await rejects(
      apiBackend.workHttp.generation.downloadResult(
        memberScope(crypto.randomUUID()),
        {
          workId: brandWorkId(input.workId),
          generationId: brandGenerationId(generation.id),
          fileId: brandFileId(file.id),
        },
      ),
      'NOT_FOUND',
    );
  }
  await rejects(
    apiBackend.workHttp.generation.downloadResult(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        generationId: brandGenerationId(generation.id),
        fileId: brandFileId(crypto.randomUUID()),
      },
    ),
    'NOT_FOUND',
  );
  await apiBackend.workHttp.intake.removeDocument(
    memberScope(input.workspaceId),
    {
      workId: brandWorkId(input.workId),
      documentId: brandDocumentId(doc.id),
    },
  );
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

test('manual edits during model execution survive acceptance of the result', async () => {
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
    const view = await apiBackend.workHttp.views.get(
      memberScope(input.workspaceId),
      brandWorkId(input.workId),
    );
    await apiBackend.workHttp.review.editValues(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        revision: view.work.revision,
        values: { ...emptyFieldValues(), personName: 'Ручное значение' },
      },
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
    await apiBackend.workHttp.intake.removeDocument(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        documentId: brandDocumentId(doc.id),
      },
    );
    const hidden = await apiBackend.workHttp.views.get(
      memberScope(input.workspaceId),
      brandWorkId(input.workId),
    );
    expect(hidden.cleanupPending).toBe(true);
    expect(hidden.facts.candidates).toEqual([]);
    expect(
      await db.processingIo.count({ where: { workId: input.workId } }),
    ).toBe(1);
    release();
    const clean = await until(
      input,
      (state) => !state.cleanupPending && !state.documents.length,
    );
    expect(clean.facts.values).toEqual(emptyFieldValues());
    expect(await db.run.count({ where: { workId: input.workId } })).toBe(0);
    expect(
      await db.workAgentThread.count({ where: { workId: input.workId } }),
    ).toBe(0);
  } finally {
    release();
    waitForExtraction = undefined;
  }
});

test('confirmation survives added sources and repeated analysis; only the new file calls the model', async () => {
  const input = await create();
  await upload(input);
  await analyze(input);
  const initial = await until(input, terminal);
  await apiBackend.workHttp.review.confirmFacts(
    memberScope(input.workspaceId),
    {
      workId: brandWorkId(input.workId),
      revision: initial.work.revision,
    },
  );
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

test('all works remain reachable across stable numbered pages', async () => {
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
  const pageSize = 24;
  for (let number = 1; number <= Math.ceil(104 / pageSize); number++) {
    const page = await apiBackend.workHttp.works.queries.list(
      memberScope(input.workspaceId),
      { page: number, pageSize, q: '', status: 'all' },
    );
    expect(page).toMatchObject({ page: number, pageSize, total: 104 });
    seen.push(...page.items.map((work) => work.id));
  }
  expect(seen).toHaveLength(104);
  expect(new Set(seen).size).toBe(104);
});

test('numbered search filters the whole workspace and counts only matching revisions', async () => {
  const input = await create();
  const foreign = await create();
  const data = Array.from({ length: 25 }, (_, index) => ({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    title: `Дело Анны ${String(index)}`,
    packageVersion: 'technical-document-v1',
    createdBy: 'fixture',
    revision: 2,
    confirmedRevision: 2,
    createdAt: new Date(2026, 0, index + 1),
  }));
  const oldest = data[0];
  if (!oldest) throw new Error('Missing fixture');
  await db.work.createMany({
    data: [
      ...data,
      {
        ...oldest,
        id: crypto.randomUUID(),
        title: 'Дело Анны 100%',
        confirmedRevision: null,
      },
      { ...oldest, id: crypto.randomUUID(), workspaceId: foreign.workspaceId },
      { ...oldest, id: crypto.randomUUID(), title: 'Другое дело' },
    ],
  });
  const page = await apiBackend.workHttp.works.queries.list(
    memberScope(input.workspaceId),
    {
      q: 'АННЫ',
      status: 'confirmed',
      page: 2,
      pageSize: 24,
    },
  );
  expect(page).toMatchObject({ page: 2, pageSize: 24, total: 25 });
  expect(page.items.map(({ id }) => id)).toEqual([oldest.id]);
  const shorterPage = await apiBackend.workHttp.works.queries.list(
    memberScope(input.workspaceId),
    { q: 'АННЫ', status: 'confirmed', page: 2, pageSize: 6 },
  );
  expect(shorterPage).toMatchObject({ page: 2, pageSize: 6, total: 25 });
  expect(shorterPage.items.map(({ id }) => id)).toEqual(
    data
      .slice(13, 19)
      .reverse()
      .map(({ id }) => id),
  );
  const draft = await apiBackend.workHttp.works.queries.list(
    memberScope(input.workspaceId),
    {
      q: 'АННЫ',
      status: 'draft',
      page: 1,
      pageSize: 24,
    },
  );
  expect(draft.total).toBe(1);
  expect(draft.items[0]?.confirmedRevision).toBeNull();
  const literal = await apiBackend.workHttp.works.queries.list(
    memberScope(input.workspaceId),
    {
      q: '%',
      status: 'all',
      page: 1,
      pageSize: 24,
    },
  );
  expect(literal.items.map(({ title }) => title)).toEqual(['Дело Анны 100%']);
});

test.each(['work document', 'standalone recognition'])(
  'replaying an upload after deletion of the %s returns NOT_FOUND',
  async (kind) => {
    const { workspaceId, workId } = await create();
    const { workHttp, documentHttp } = apiBackend;
    const access = {
      ...workHttp.access,
      session: () =>
        Promise.resolve({
          user: {
            id: 'fixture',
            name: 'Fixture',
            email: 'fixture@example.test',
          },
          memberships: [
            {
              workspace: { id: workspaceId, name: 'Workspace' },
              rights: [...rightCatalog],
            },
          ],
        }),
    };
    const app = createApp({
      environment: 'test',
      logger,
      workHttp: { ...workHttp, access },
      documentHttp: { ...documentHttp, access },
    }).listen({ hostname: '127.0.0.1', port: 0 });
    try {
      const port = app.server?.port;
      if (port === undefined) throw new Error('NO_HTTP_LISTENER');
      const workspacePath = `http://127.0.0.1:${String(port)}/api/v1/workspaces/${workspaceId}`;
      const target =
        kind === 'work document'
          ? `${workspacePath}/works/${workId}/documents`
          : `${workspacePath}/recognitions`;
      const key = crypto.randomUUID();
      const origin = workHttp.origin;
      const post = () => {
        const body = new FormData();
        body.set(
          'file',
          new File(['%PDF-1.7\n synthetic'], 'fixture.pdf', {
            type: 'application/pdf',
          }),
        );
        return fetch(target, {
          method: 'POST',
          headers: { origin, 'idempotency-key': key },
          body,
        });
      };
      const first = await post();
      expect(first.status).toBe(202);
      const payload = z
        .object({ document: z.object({ id: z.uuid() }) })
        .parse(await first.clone().json());
      const cached = await post();
      expect(cached.status).toBe(202);
      expect(await cached.text()).toBe(await first.text());
      const deletion = await fetch(`${target}/${payload.document.id}`, {
        method: 'DELETE',
        headers: { origin },
      });
      expect(deletion.status).toBe(202);

      const replay = await post();
      expect(replay.status).toBe(404);
      const requestId = replay.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
      expect(await replay.json()).toEqual({
        error: { code: 'NOT_FOUND', requestId },
      });
      expect(
        await db.idempotencyKey.findFirstOrThrow({
          where: { workspaceId, key },
        }),
      ).toMatchObject({
        resourceKind: 'document',
        resourceId: payload.document.id,
        state: 'resource_unavailable',
        status: null,
        body: null,
      });
    } finally {
      await app.stop();
    }
  },
);

test('owner deletion fences a running writer then physically purges the work and its files', async () => {
  const input = await create();
  const source = await upload(input);
  const scope = memberScope(input.workspaceId, 'fixture');
  const spare = await apiBackend.documentHttp.documents.commands.upload(scope, {
    filename: 'standalone.pdf',
    bytes: new TextEncoder().encode('%PDF-1.7\n standalone'),
    correlationId: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
  });
  await analyze(input);
  const analyzed = await until(input, terminal);
  expect(analyzed.facts.values.personName).toBe('Анна');
  const responses = apiBackend.workHttp.idempotency;
  const makeRef = (command: string) => ({
    workspaceId: input.workspaceId,
    command,
    key: crypto.randomUUID(),
    fingerprint: 'synthetic',
  });
  const cachedWork = makeRef('POST /workspaces/:workspaceId/works');
  const cachedSource = makeRef(
    'POST /workspaces/:workspaceId/works/:workId/documents',
  );
  const workResponse = () =>
    Promise.resolve({
      response: { status: 201, body: 'opaque work reply' },
      resource: { kind: 'work' as const, id: input.workId },
    });
  const sourceResponse = () =>
    Promise.resolve({
      response: { status: 202, body: 'opaque document reply' },
      resource: { kind: 'document' as const, id: source.id },
    });
  const unrelated = makeRef(cachedWork.command);
  const similarResponse = await responses.run(unrelated, () =>
    Promise.resolve({
      response: {
        status: 201,
        body: JSON.stringify({ work: { id: input.workId } }),
      },
    }),
  );
  expect(await responses.run(cachedWork, workResponse)).toMatchObject({
    kind: 'response',
    replayed: false,
  });
  expect(await responses.run(cachedSource, sourceResponse)).toMatchObject({
    kind: 'response',
    replayed: false,
  });
  const ref = { workspaceId: input.workspaceId, workId: input.workId };
  const ownedThreads = await db.workAgentThread.findMany({
    where: ref,
    select: { id: true },
  });
  expect(ownedThreads.some(({ id }) => threads.has(id))).toBe(true);
  const sourceKey = (
    await db.sourceDocument.findUniqueOrThrow({ where: { id: source.id } })
  ).sourceKey;
  expect(files.has(sourceKey)).toBe(true);
  const writeStarted = Promise.withResolvers<undefined>();
  const finishWrite = Promise.withResolvers<undefined>();
  pauseGeneratedWrite = () => {
    writeStarted.resolve(undefined);
    return finishWrite.promise;
  };
  const deletion = apiBackend.workHttp.deletion;
  let generationKey: string;
  try {
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId: input.workId,
      revision: analyzed.work.revision,
      correlationId: crypto.randomUUID(),
    });
    await Promise.race([
      writeStarted.promise,
      Bun.sleep(12000).then(() => {
        throw new Error('WRITE_DID_NOT_START');
      }),
    ]);
    generationKey = (await db.workArtifact.findFirstOrThrow({ where: ref }))
      .key;
    await rejects(
      deletion.request(
        memberScope(input.workspaceId, 'member', ['works.read', 'works.edit']),
        input.workId,
        crypto.randomUUID(),
      ),
      'FORBIDDEN',
    );
    await rejects(
      deletion.request(
        memberScope(crypto.randomUUID()),
        input.workId,
        crypto.randomUUID(),
      ),
      'NOT_FOUND',
    );
    expect(
      await deletion.request(scope, input.workId, crypto.randomUUID()),
    ).toEqual({ status: 'deleting' });
    await rejects(
      apiBackend.workHttp.views.get(scope, input.workId),
      'NOT_FOUND',
    );
    expect(
      (
        await apiBackend.workHttp.works.queries.list(scope, {
          page: 1,
          pageSize: 24,
          q: '',
          status: 'all',
        })
      ).items,
    ).toEqual([]);
    expect(
      await db.run.findFirst({
        where: { ...ref, kind: 'work.generation' },
        select: { status: true, attemptToken: true },
      }),
    ).toEqual({ status: 'cancelled', attemptToken: null });
    expect((await deletion.status(scope, input.workId)).status).not.toBe(
      'deleted',
    );
    const lateResponse = makeRef(cachedWork.command);
    expect(await responses.run(lateResponse, workResponse)).toMatchObject({
      kind: 'response',
      replayed: false,
    });
    for (const ref of [cachedWork, cachedSource, lateResponse]) {
      const response = await responses.run(ref, () => {
        throw new Error('DELETED_RESPONSE_REEXECUTED');
      });
      expect(response).toEqual({
        kind: 'resource_unavailable',
        replayed: true,
      });
    }
    expect(
      await db.idempotencyKey.count({
        where: {
          workspaceId: input.workspaceId,
          key: { in: [cachedWork.key, cachedSource.key, lateResponse.key] },
          body: { not: null },
        },
      }),
    ).toBe(0);
    expect(
      await responses.run(unrelated, () => {
        throw new Error('UNRELATED_RESPONSE_REEXECUTED');
      }),
    ).toEqual({ ...similarResponse, replayed: true });
  } finally {
    finishWrite.resolve(undefined);
    pauseGeneratedWrite = undefined;
  }
  const deadline = Date.now() + 15000;
  while (
    Date.now() < deadline &&
    (await deletion.status(scope, input.workId)).status !== 'deleted'
  ) {
    await Bun.sleep(50);
  }
  expect(await deletion.status(scope, input.workId)).toEqual({
    status: 'deleted',
  });
  expect(
    await deletion.request(scope, input.workId, crypto.randomUUID()),
  ).toEqual({ status: 'deleted' });
  expect(await db.work.findUnique({ where: { id: input.workId } })).toBeNull();
  expect(await db.workFacts.count({ where: ref })).toBe(0);
  expect(await db.workGeneration.count({ where: ref })).toBe(0);
  expect(await db.workAgentSession.count({ where: ref })).toBe(0);
  expect(
    await db.run.count({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ workId: input.workId }, { documentId: source.id }],
      },
    }),
  ).toBe(0);
  expect(
    await db.sourceDocument.findUnique({ where: { id: source.id } }),
  ).toBeNull();
  expect(ownedThreads.some(({ id }) => threads.has(id))).toBe(false);
  expect(files.has(sourceKey)).toBe(false);
  expect(files.has(generationKey)).toBe(false);
  expect(
    await apiBackend.documentHttp.documents.queries.get(
      scope,
      brandDocumentId(spare.id),
    ),
  ).toMatchObject({ id: spare.id });
  expect(
    await db.auditEvent.count({
      where: {
        workspaceId: input.workspaceId,
        action: 'works.deletion_requested',
      },
    }),
  ).toBe(1);
}, 45000);

const fixtureImage = Uint8Array.fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
);

test('work document source, recognition result and image share the same access matrix', async () => {
  const { workspaceId, workId } = await create();
  const scope = memberScope(workspaceId, 'fixture', ['works.read']);
  const otherWorkId = await apiBackend.workHttp.intake.createWork(
    memberScope(workspaceId, 'fixture'),
    { packageVersion: 'technical-document-v1', title: 'Другая работа' },
  );
  imageFixture = [
    {
      path: 'images/fixture.png',
      contentType: 'image/png',
      bytes: fixtureImage,
    },
  ];
  try {
    const doc = await upload({ workspaceId, workId });
    const documentId = brandDocumentId(doc.id);
    await until({ workspaceId, workId }, (view) =>
      view.documents.some(
        (document) =>
          document.id === documentId && document.status === 'succeeded',
      ),
    );
    const { views } = apiBackend.workHttp;
    const reads = [
      {
        read: views.source,
        value: { filename: 'fixture.pdf', contentType: 'application/pdf' },
      },
      {
        read: views.result,
        value: {
          markdown: 'Имя: Анна. Номер: 42.',
          images: [{ path: 'images/fixture.png', index: 0 }],
        },
      },
      {
        read: (
          requestScope: typeof scope,
          work: typeof workId,
          doc: typeof documentId,
        ) => views.image(requestScope, work, doc, 0),
        value: { contentType: 'image/png', bytes: fixtureImage },
      },
    ];
    for (const { read, value } of reads)
      expect(await read(scope, workId, documentId)).toMatchObject(value);

    const cases = [
      { scope, workId: otherWorkId, code: 'NOT_FOUND' },
      { scope: memberScope(crypto.randomUUID()), workId, code: 'NOT_FOUND' },
      {
        scope: memberScope(workspaceId, 'fixture', ['recognitions.use']),
        workId,
        code: 'FORBIDDEN',
      },
    ];
    for (const entry of cases)
      for (const { read } of reads)
        await rejects(read(entry.scope, entry.workId, documentId), entry.code);

    const deletedAt = new Date();
    await db.work.update({ where: { id: workId }, data: { deletedAt } });
    for (const { read } of reads)
      await rejects(read(scope, workId, documentId), 'NOT_FOUND');
    await db.work.update({ where: { id: workId }, data: { deletedAt: null } });

    await db.sourceDocument.update({
      where: { id: documentId },
      data: { deletedAt },
    });
    for (const { read } of reads)
      await rejects(read(scope, workId, documentId), 'NOT_FOUND');
  } finally {
    imageFixture = [];
  }
}, 45000);

function holdFirstVisual() {
  const release = Promise.withResolvers<undefined>();
  const started = Promise.withResolvers<undefined>();
  imageFixture = [
    {
      path: 'images/connection-fixture.png',
      contentType: 'image/png',
      bytes: fixtureImage,
    },
  ];
  waitForVision = () => {
    started.resolve(undefined);
    return release.promise;
  };
  return {
    async started() {
      const timeout = AbortSignal.timeout(7000);
      await Promise.race([
        started.promise,
        new Promise<never>((_, reject) => {
          timeout.addEventListener('abort', () => {
            reject(new Error('VISION_NOT_STARTED'));
          });
        }),
      ]);
    },
    release: () => {
      release.resolve(undefined);
    },
    cleanup() {
      release.resolve(undefined);
      waitForVision = undefined;
      imageFixture = [];
    },
  };
}
const rotatedConnection = () => ({
  baseURL: 'http://127.0.0.1:1/v1',
  visionModel: 'next-vision',
  extractionModel: 'next-extraction',
  apiKey: crypto.randomUUID(),
});

test('rotating the workspace connection during analysis preserves the recorded revision', async () => {
  const input = await create();
  const visual = holdFirstVisual();
  try {
    await upload(input);
    await analyze(input);
    await visual.started();
    await runtime.saveSettings(input.workspaceId, rotatedConnection());
    visual.release();
    const state = await until(input, terminal);
    expect(state.runs[0]?.status).toBe('succeeded');
    expect(extractionModel).toBe('fixture');
    expect(
      (await db.run.findFirstOrThrow({ where: { workId: input.workId } }))
        .settingsRevision,
    ).toBe(1);
  } finally {
    visual.cleanup();
  }
});

test('revoking the recorded revision stops analysis before another model call even after reconfiguration', async () => {
  const input = await create();
  const visual = holdFirstVisual();
  const scopes = memberScope(input.workspaceId);
  const before = extractionCount;
  try {
    await upload(input);
    await analyze(input);
    await visual.started();
    await apiBackend.workHttp.settings.revoke(scopes);
    await apiBackend.workHttp.settings.revoke(scopes);
    expect(await apiBackend.workHttp.settings.current(scopes)).toEqual({
      settings: null,
      canManage: true,
    });
    const revisions = await db.llmSettings.findMany({
      where: { workspaceId: input.workspaceId },
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({
      revision: 1,
      encryptedKey: '',
    });
    const events = await db.auditEvent.findMany({
      where: { workspaceId: input.workspaceId, action: 'connections.revoked' },
      select: { data: true },
    });
    expect(events).toEqual([{ data: { revision: 1, count: 1 } }]);
    // A replacement makes the test catch an accidental latest-revision fallback.
    await runtime.saveSettings(input.workspaceId, rotatedConnection());
    visual.release();
    const state = await until(input, terminal);
    expect(state.runs[0]).toMatchObject({
      status: 'failed',
      errorCode: 'CONNECTION_REVOKED',
    });
    expect(extractionCount).toBe(before);
  } finally {
    visual.cleanup();
  }
});

function pauseStep() {
  const release = Promise.withResolvers<undefined>();
  const entered = Promise.withResolvers<undefined>();
  return {
    wait: () => {
      entered.resolve(undefined);
      return release.promise;
    },
    release: () => {
      release.resolve(undefined);
    },
    async entered() {
      const timeout = AbortSignal.timeout(7000);
      await Promise.race([
        entered.promise,
        new Promise<never>((_, reject) => {
          timeout.addEventListener('abort', () => {
            reject(new Error('STEP_NOT_ENTERED'));
          });
        }),
      ]);
    },
  };
}

test('revoking while MinerU is processing does not stop OCR or call the model', async () => {
  const input = await create();
  const step = pauseStep();
  pauseOcr = step.wait;
  const before = extractionCount;
  try {
    const doc = await upload(input);
    await step.entered();
    await apiBackend.workHttp.settings.revoke(memberScope(input.workspaceId));
    step.release();
    await until(input, (view) =>
      view.documents.some(
        (item) => item.id === doc.id && item.status === 'succeeded',
      ),
    );
    const run = await db.run.findFirstOrThrow({
      where: { workspaceId: input.workspaceId, documentId: doc.id },
    });
    expect(run).toMatchObject({
      kind: 'document.ocr',
      settingsRevision: null,
      status: 'succeeded',
    });
    expect(extractionCount).toBe(before);
  } finally {
    step.release();
    pauseOcr = undefined;
  }
});

test('revoking a recorded revision during DOCX publication does not stop local generation', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const step = pauseStep();
  pauseGeneratedWrite = step.wait;
  const before = extractionCount;
  try {
    const view = await apiBackend.workHttp.views.get(
      scope,
      brandWorkId(input.workId),
    );
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId: brandWorkId(input.workId),
      revision: view.work.revision,
      correlationId: crypto.randomUUID(),
    });
    await step.entered();
    await apiBackend.workHttp.settings.revoke(scope);
    step.release();
    const completed = await until(input, terminal);
    expect(completed.runs[0]).toMatchObject({
      kind: 'generation',
      status: 'succeeded',
    });
    const run = await db.run.findFirstOrThrow({
      where: { workId: input.workId, kind: 'work.generation' },
    });
    expect(run.settingsRevision).toBe(1);
    expect(extractionCount).toBe(before);
  } finally {
    step.release();
    pauseGeneratedWrite = undefined;
  }
});

test('rotation followed by revocation stops a run pinned to the old revision before the next model call', async () => {
  const input = await create();
  const visual = holdFirstVisual();
  const scope = memberScope(input.workspaceId);
  const before = extractionCount;
  try {
    await upload(input);
    await analyze(input);
    await visual.started();
    await runtime.saveSettings(input.workspaceId, rotatedConnection());
    await apiBackend.workHttp.settings.revoke(scope);
    visual.release();
    const state = await until(input, terminal);
    expect(state.runs[0]).toMatchObject({
      status: 'failed',
      errorCode: 'CONNECTION_REVOKED',
    });
    expect(extractionCount).toBe(before);
    expect(
      await db.llmSettings.count({ where: { workspaceId: input.workspaceId } }),
    ).toBe(2);
    expect(
      await db.llmSettings.count({
        where: {
          workspaceId: input.workspaceId,
          revokedAt: { not: null },
          encryptedKey: '',
        },
      }),
    ).toBe(2);
    expect(
      await db.auditEvent.findMany({
        where: {
          workspaceId: input.workspaceId,
          action: 'connections.revoked',
        },
        select: { data: true },
      }),
    ).toEqual([{ data: { revision: 2, count: 2 } }]);
  } finally {
    visual.cleanup();
  }
});

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
    await apiBackend.workHttp.intake.removeDocument(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        documentId: brandDocumentId(doc.id),
      },
    );
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
    pool: actualPool,
    timeoutMs: 5000,
  });
  const inspection = new PostgresStore({
    id: 'test-inspection',
    connectionString: databaseUrl,
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
    const vision = await db.runStep.findFirstOrThrow({
      where: { run: { workId: input.workId }, stage: 'vision' },
    });
    expect(vision.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    threadIds = await workProcessing.threads(input.workspaceId, input.workId);
    const memory = await inspection.getStore('memory');
    if (!memory || !threadIds[0]) throw new Error('MISSING_MEMORY_FIXTURE');
    expect(
      (await memory.listMessages({ threadId: threadIds[0] })).messages.length,
    ).toBeGreaterThan(0);
    await apiBackend.workHttp.intake.removeDocument(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        documentId: brandDocumentId(doc.id),
      },
    );
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
  const reopened = createBackend(testConfig, {
    logger,
    role: 'api',
    dependencies: { storage, agents },
  });
  try {
    expect(
      (
        await reopened.workHttp.views.get(
          memberScope(input.workspaceId),
          brandWorkId(input.workId),
        )
      ).session?.id,
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
      const state = await apiBackend.workHttp.views.get(
        memberScope(input.workspaceId),
        brandWorkId(input.workId),
      );
      await apiBackend.workHttp.review.editValues(
        memberScope(input.workspaceId),
        {
          workId: brandWorkId(input.workId),
          revision: state.work.revision,
          values: { ...state.facts.values, personName: 'Ручное имя' },
        },
      );
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
    await apiBackend.workHttp.intake.removeDocument(
      memberScope(input.workspaceId),
      {
        workId: brandWorkId(input.workId),
        documentId: brandDocumentId(doc.id),
      },
    );
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
      await workProcessing.threads(input.workspaceId, input.workId),
    ).toEqual([]);
  } finally {
    release();
    reconcileHook = undefined;
  }
});

type Command = keyof WorkView['availability'];
type Reason = Extract<
  WorkView['availability'][Command],
  { available: false }
>['reason'];
const availabilityCases: {
  state: string;
  blocked: Partial<Record<Command, Reason>>;
}[] = [
  { state: 'ready', blocked: {} },
  {
    state: 'empty',
    blocked: { analyze: 'NO_DOCUMENTS', remove: 'NO_DOCUMENTS' },
  },
  {
    state: 'busy',
    blocked: {
      analyze: 'WORK_BUSY',
      generate: 'WORK_BUSY',
      confirm: 'WORK_BUSY',
    },
  },
  {
    state: 'cleanup',
    blocked: {
      analyze: 'CLEANUP_PENDING',
      generate: 'CLEANUP_PENDING',
      confirm: 'CLEANUP_PENDING',
      upload: 'CLEANUP_PENDING',
    },
  },
  { state: 'revoked', blocked: { analyze: 'CONNECTION_REVOKED' } },
  { state: 'unconfigured', blocked: { analyze: 'LLM_NOT_CONFIGURED' } },
  {
    state: 'read-only',
    blocked: {
      analyze: 'FORBIDDEN',
      generate: 'FORBIDDEN',
      confirm: 'FORBIDDEN',
      upload: 'FORBIDDEN',
      remove: 'FORBIDDEN',
    },
  },
];

const commands: Command[] = [
  'analyze',
  'generate',
  'confirm',
  'upload',
  'remove',
];
test.each(
  availabilityCases.flatMap(({ state, blocked }) =>
    commands.map((command) => ({ state, command, reason: blocked[command] })),
  ),
)(
  'work availability agrees with $command in state $state',
  async ({ state, command, reason }) => {
    const { workspaceId, workId } = await create();
    const document =
      state !== 'empty' && (await upload({ workspaceId, workId }));
    const owner = memberScope(workspaceId);
    const scope =
      state === 'read-only'
        ? memberScope(workspaceId, 'reader', ['works.read'])
        : owner;
    if (state === 'busy')
      await db.run.create({
        data: {
          id: crypto.randomUUID(),
          workspaceId,
          workId,
          kind: 'work.analysis',
          inputRevision: 1,
          documentIds: document ? [document.id] : [],
          settingsRevision: 1,
          modelSnapshot: { vision: 'fixture', extraction: 'fixture' },
          initiatedBy: owner.userId,
          correlationId: crypto.randomUUID(),
        },
      });
    if (state === 'cleanup')
      await db.processingIo.create({
        data: {
          id: crypto.randomUUID(),
          kind: 'work',
          workspaceId,
          workId,
          uncertain: true,
        },
      });
    if (state === 'revoked') await apiBackend.workHttp.settings.revoke(owner);
    if (state === 'unconfigured')
      await db.llmSettings.deleteMany({ where: { workspaceId } });
    const view = await apiBackend.workHttp.views.get(scope, workId);
    expect(view.availability[command]).toEqual(
      reason ? { available: false, reason } : { available: true },
    );

    const correlationId = crypto.randomUUID();
    const revision = view.work.revision;
    const execute: Record<Command, () => Promise<unknown>> = {
      analyze: () =>
        apiBackend.workHttp.intake.analyzeWork(scope, {
          workId,
          correlationId,
        }),
      generate: () =>
        apiBackend.workHttp.generation.startGeneration(scope, {
          workId,
          correlationId,
          revision,
        }),
      confirm: () =>
        apiBackend.workHttp.review.confirmFacts(scope, { workId, revision }),
      upload: () =>
        apiBackend.workHttp.intake.uploadDocument(scope, {
          workId,
          correlationId,
          filename: 'next.pdf',
          bytes: new TextEncoder().encode('%PDF-1.7\n synthetic'),
          requestKey: crypto.randomUUID(),
        }),
      remove: () =>
        apiBackend.workHttp.intake.removeDocument(scope, {
          workId,
          documentId: brandDocumentId(
            document ? document.id : crypto.randomUUID(),
          ),
        }),
    };
    if (!reason) await execute[command]();
    else
      await rejects(
        execute[command](),
        reason === 'NO_DOCUMENTS'
          ? command === 'remove'
            ? 'NOT_FOUND'
            : 'INVALID_WORK_INPUT'
          : reason,
      );
  },
);

test('server rejects upload at the work source limit and reports the reason', async () => {
  const input = await create();
  for (let i = 0; i < 20; i++) await upload(input);
  const view = await apiBackend.workHttp.views.get(
    memberScope(input.workspaceId),
    input.workId,
  );
  expect(view.availability.upload).toEqual({
    available: false,
    reason: 'SOURCE_LIMIT_REACHED',
  });
  await rejects(upload(input), 'INVALID_WORK_INPUT');
});
