import { afterAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PostgresStore } from '@mastra/pg';
import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import { rightCatalog } from '@anyko/backend/scope';
import {
  getWorkAgentHistory,
  workResponseSchema,
} from '@anyko/contracts/works';
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
let chatHook: DocumentAgents['chat'] | undefined;
let extractionCount = 0;
const extractionDocuments = new Map<string, string[]>();
let failExtraction = false;
let failDocument: string | undefined;
let actualAgents: DocumentAgents | undefined;
let extractedName = 'Анна';
let imageFixture: { path: string; contentType: string; bytes: Uint8Array }[] =
  [];
let describeCount = 0;
const descriptionsByResource = new Map<string, number>();
let waitForVision: (() => Promise<void>) | undefined;
let extractionModel: string | undefined;
let waitForExtraction:
  | ((input: Parameters<DocumentAgents['extract']>[0]) => Promise<void>)
  | undefined;
let extractFixture: DocumentAgents['extract'] | undefined;
let parseFixture: DocumentParser['parseDocument'] | undefined;
const agents: DocumentAgents = {
  chat(input) {
    if (chatHook) return chatHook(input);
    throw new Error('UNEXPECTED_CHAT');
  },
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
    descriptionsByResource.set(
      input.resource,
      (descriptionsByResource.get(input.resource) ?? 0) + 1,
    );
    if (actualAgents) return actualAgents.describe(input);
    await waitForVision?.();
    return {
      description:
        input.purpose === 'transcription'
          ? 'Заявитель: Анна\nКонтроль: 42'
          : 'Белый шкаф с двумя дверцами.',
      usage: { inputTokens: 3, outputTokens: 4 },
    };
  },
  async extract(input) {
    if (actualAgents) return actualAgents.extract(input);
    if (extractFixture) return extractFixture(input);
    extractionCount++;
    const extracted = extractionDocuments.get(input.resource) ?? [];
    extracted.push(input.document.id);
    extractionDocuments.set(input.resource, extracted);
    extractionModel = input.modelId;
    threads.add(input.threadId);
    await waitForExtraction?.(input);
    if (failDocument === input.document.id)
      throw new LlmError('LLM_INVALID_RESPONSE');
    if (failExtraction) throw new LlmError('LLM_RATE_LIMITED');
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
const workLog: string[] = [];
const logger = createLogger(
  {
    service: 'worker',
    environment: 'test',
    release: 'work-integration',
    level: 'error',
  },
  {
    write: (line) => {
      workLog.push(line);
    },
  },
);
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
const workerPrefix = `test-work-${crypto.randomUUID()}`;
async function ready() {
  if (worker) return;
  await workerBackend.ready();
  worker = await startJobWorker(workerBackend.jobs, {
    prefix: workerPrefix,
  });
}
async function create(packageVersion = 'technical-document-v1') {
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
    { packageVersion, title: 'Тестовая работа' },
  );
  return { workspaceId, workId };
}
async function until(
  input: { workspaceId: string; workId: string },
  predicate: (view: WorkView) => boolean | Promise<boolean>,
) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const view = await apiBackend.workHttp.views.get(
      memberScope(input.workspaceId),
      brandWorkId(input.workId),
    );
    if (await predicate(view)) return view;
    await Bun.sleep(30);
  }
  throw new Error('WORK_STATUS_TIMEOUT');
}
const terminal = (view: WorkView) =>
  view.pendingUploadCount === 0 &&
  !!view.runs.length &&
  view.runs.every((run) => !['queued', 'running'].includes(run.status));

test('the source checklist preserves scoped manual decisions when the work is analysed again', async () => {
  const input = await create('bfl-bankruptcy-v7');
  const { workspaceId, workId } = input;
  const scope = memberScope(workspaceId);
  const app = fixtureApp(workspaceId);
  const workUrl = `http://localhost/api/v1/workspaces/${workspaceId}/works/${workId}`;
  const read = async () => {
    const response = await app.handle(new Request(workUrl));
    expect(response.status).toBe(200);
    return workResponseSchema.parse(await response.json()).checklist ?? [];
  };
  const set = (
    key: string,
    documentId: string,
    decision: 'confirmed' | 'rejected',
    ocrRevision: number | null,
  ) =>
    app.handle(
      new Request(`${workUrl}/checklist-items/${key}/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          origin: apiBackend.workHttp.origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ decision, ocrRevision }),
      }),
    );
  const before = await read();
  expect(before.filter(({ key }) => key === 'debt-certificate')).toHaveLength(
    1,
  );
  expect(before.find(({ key }) => key === 'passport')?.status).toBe('missing');
  expect(before.find(({ key }) => key === 'marriage')?.status).toBe('clarify');
  expect(
    (await set('passport', crypto.randomUUID(), 'confirmed', null)).status,
  ).toBe(404);

  const quote = 'АО Синтетический Банк\nДоговор № A-42 от 03.01.2025';
  const obligation = {
    name: 'АО Синтетический Банк',
    contractNumber: 'A-42',
    contractDate: '03.01.2025',
    amountDate: '08.11.2026',
    debtStatus: 'Действует',
    amount: '42.00',
  };
  extractFixture = ({ document }) =>
    Promise.resolve({
      candidates:
        document.text.includes(quote) && document.id === certificateId
          ? [
              {
                field: 'debts',
                value: [
                  {
                    name: obligation.name,
                    contractNumber: obligation.contractNumber,
                    contractDate: obligation.contractDate,
                  },
                ],
                evidence: [{ documentId: document.id, imagePath: null, quote }],
              },
            ]
          : [],
      usage: { inputTokens: 7, outputTokens: 9 },
    });
  let certificateId: string | undefined;
  const certificateUpload = pauseStep();
  parseFixture = async () => {
    await certificateUpload.wait();
    return {
      markdown: quote,
      processorVersion: 'checklist-fixture',
    };
  };
  reconcileHook = ({ documents, checklistRequirements }) => {
    expect(
      checklistRequirements?.some(({ key }) => key === 'debt-certificate'),
    ).toBe(true);
    return Promise.resolve({
      summary: 'Проверены исходники',
      candidates: [],
      usage: { inputTokens: 7, outputTokens: 9 },
      checklistSuggestions: [
        ...documents.flatMap(({ id }) => [
          {
            requirementKey: 'debt-certificate',
            documentId: id,
            quote,
            imagePath: null,
            decision: 'found' as const,
          },
          {
            requirementKey: 'bank-statement',
            documentId: id,
            quote,
            imagePath: null,
            decision: 'review' as const,
          },
          {
            requirementKey: 'marriage',
            documentId: id,
            quote: 'Выдуманная цитата',
            imagePath: null,
            decision: 'found' as const,
          },
        ]),
      ],
    });
  };
  try {
    const first = await upload(input, 'first checklist input');
    certificateId = first.id;
    certificateUpload.release();
    const second = await upload(input, 'second checklist input');
    const view = await until(
      input,
      (state) =>
        terminal(state) &&
        state.checklist.find(({ key }) => key === 'debt-certificate')?.sources
          .length === 2,
    );
    const current = view.documents.find(
      ({ id }) => id === first.id,
    )?.processingRevision;
    if (!current) throw new Error('CHECKLIST_SOURCE_NOT_RECOGNISED');
    const beforeEdits = await apiBackend.workHttp.views.get(scope, workId);
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: beforeEdits.work.revision,
      values: {
        ...beforeEdits.facts.values,
        debts: [obligation, { ...obligation, contractNumber: 'B-42' }],
      },
    });
    expect(
      (await set('debt-certificate', first.id, 'confirmed', current + 1))
        .status,
    ).toBe(409);
    expect(
      (await set('debt-certificate', first.id, 'confirmed', current)).status,
    ).toBe(200);
    expect(
      (await set('bank-statement', first.id, 'rejected', current)).status,
    ).toBe(200);
    await analyze(input);
    await until(input, terminal);
    const checklist = await read();
    const debts = checklist.find(({ key }) => key === 'debt-certificate');
    expect(debts?.status).toBe('confirmed');
    expect(debts?.contracts).toMatchObject([
      { contractNumber: 'A-42', status: 'confirmed', documentIds: [first.id] },
      { contractNumber: 'B-42', status: 'missing', documentIds: [] },
    ]);
    expect(
      debts?.sources.find(({ documentId }) => documentId === first.id),
    ).toMatchObject({
      status: 'confirmed',
      quote,
    });
    expect(
      debts?.sources.find(({ documentId }) => documentId === second.id),
    ).toMatchObject({
      status: 'found',
      quote,
    });
    expect(
      checklist.find(({ key }) => key === 'bank-statement')?.sources,
    ).toMatchObject([{ documentId: second.id, status: 'review' }]);
    expect(checklist.find(({ key }) => key === 'marriage')?.status).toBe(
      'clarify',
    );
    await apiBackend.workHttp.intake.removeDocument(scope, {
      workId,
      documentId: brandDocumentId(first.id),
    });
    await until(
      input,
      (state) => !state.cleanupPending && state.documents.length === 1,
    );
    expect(
      (await read()).find(({ key }) => key === 'debt-certificate')?.sources,
    ).toMatchObject([{ documentId: second.id, status: 'found' }]);
  } finally {
    certificateUpload.release();
    parseFixture = undefined;
    extractFixture = undefined;
    reconcileHook = undefined;
  }
});

test('a bankruptcy statement can be formed, downloaded and the work confirmed without source files', async () => {
  const input = await create('bfl-bankruptcy-v7');
  const scope = memberScope(input.workspaceId);
  const { generation, review, views } = apiBackend.workHttp;
  const { workId } = input;
  const empty = await views.get(scope, workId);
  expect(empty.documents).toEqual([]);
  expect(empty.checklist.every(({ sources }) => sources.length === 0)).toBe(
    true,
  );
  expect(empty.availability.generate).toEqual({ available: true });
  await generation.startGeneration(scope, {
    workId,
    revision: empty.work.revision,
    correlationId: crypto.randomUUID(),
  });
  const completed = await until(input, terminal);
  const result = completed.generations.find(
    ({ status }) => status === 'succeeded',
  );
  const statement = result?.files.find(
    ({ templateVersion }) => templateVersion === 'bfl-statement-v7',
  );
  if (!result || !statement) throw new Error('MISSING_BLANK_STATEMENT');
  const { bytes } = await generation.downloadResult(scope, {
    workId,
    generationId: brandGenerationId(result.id),
    fileId: brandFileId(statement.id),
  });
  expect(unzipSync(bytes)['word/document.xml']).toBeDefined();
  await review.confirmFacts(scope, {
    workId,
    revision: completed.work.revision,
  });
  const final = await views.get(scope, workId);
  expect(final.work.confirmedRevision).toBe(final.work.revision);
});

test('one persisted package date reaches all four printed positions and previous downloads stay intact', async () => {
  const input = await create('bfl-bankruptcy-v8');
  const scope = memberScope(input.workspaceId);
  const { workId } = input;
  const { views, review, generation } = apiBackend.workHttp;
  const initial = await views.get(scope, workId);
  expect(initial.facts.values.documentDate).toBeNull();
  expect(initial.checklist.some(({ key }) => key === 'passport')).toBe(true);
  await review.editValues(scope, {
    workId,
    revision: initial.work.revision,
    values: {
      ...initial.facts.values,
      firstName: 'Елена',
      lastName: 'Тестова',
      middleName: 'Павловна',
      inn: '123456789012',
    },
  });
  const generate = async () => {
    const before = await views.get(scope, workId);
    await generation.startGeneration(scope, {
      workId,
      revision: before.work.revision,
      correlationId: crypto.randomUUID(),
    });
    return until(
      input,
      (state) =>
        terminal(state) && state.generations.length > before.generations.length,
    );
  };
  const read = async (item: WorkView['generations'][number], date: string) => {
    expect(item.status).toBe('succeeded');
    expect(item.files).toHaveLength(3);
    const contents = new Map<string, string>();
    for (const file of item.files) {
      const { bytes } = await generation.downloadResult(scope, {
        workId,
        generationId: brandGenerationId(item.id),
        fileId: brandFileId(file.id),
      });
      const xml = strFromU8(
        unzipSync(bytes)['word/document.xml'] ?? new Uint8Array(),
      );
      const printed = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
        .map((match) => match[1])
        .join('');
      expect(printed.split(date)).toHaveLength(
        file.templateVersion === 'bfl-statement-v8' ? 3 : 2,
      );
      contents.set(file.templateVersion, printed);
    }
    return contents.get('bfl-statement-v8');
  };
  const first = await generate();
  const chosenDate = first.facts.values.documentDate;
  expect(chosenDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  if (typeof chosenDate !== 'string' || !first.generations[0])
    throw new Error('MISSING_DATED_GENERATION');
  const firstStatement = await read(first.generations[0], chosenDate);
  expect(firstStatement).toContain('Тестова Елена Павловна');
  expect(firstStatement).toContain('Признать Тестову Елену Павловну');
  expect(firstStatement).toContain('несостоятельной (банкротом)');
  expect(firstStatement).toContain('Содружество');
  expect(firstStatement).toContain(
    'На основании ст. 213.4 п. 4 абз. 2 ФЗ «О несостоятельности (банкротстве)» предоставить мне отсрочку внесения средств на выплату вознаграждения финансовому управляющему сроком до даты судебного заседания по рассмотрению обоснованности заявления о признании банкротом.',
  );

  const source = await upload(input, 'source added after generation');
  await until(
    input,
    (view) =>
      terminal(view) && view.documents.some(({ id }) => id === source.id),
  );
  const repeated = await generate();
  expect(repeated.facts.values.documentDate).toBe(chosenDate);
  if (!repeated.generations[0]) throw new Error('MISSING_DATED_GENERATION');
  await read(repeated.generations[0], chosenDate);

  await review.editValues(scope, {
    workId,
    revision: repeated.work.revision,
    values: {
      ...repeated.facts.values,
      documentDate: '2024-06-30',
      firstName: 'Иван',
      lastName: 'Тестов',
      middleName: 'Павлович',
      sroName: 'Синтетическое объединение управляющих',
    },
  });
  const next = await generate();
  expect(next.facts.values.documentDate).toBe('30.06.2024');
  if (!next.generations[0]) throw new Error('MISSING_DATED_GENERATION');
  const newStatement = await read(next.generations[0], '30.06.2024');
  expect(newStatement).toContain('Тестов Иван Павлович');
  expect(newStatement).toContain('Признать Тестова Ивана Павловича');
  expect(newStatement).toContain('несостоятельным (банкротом)');
  expect(newStatement).toContain('Синтетическое объединение управляющих');
  expect(newStatement).not.toContain('Содружество');
  expect(await read(first.generations[0], chosenDate)).toBe(firstStatement);
});

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
    await apiBackend.documentHttp.documents.commands.retry(
      scope,
      brandDocumentId(document.id),
      crypto.randomUUID(),
    );
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
async function upload(
  input: { workspaceId: string; workId: string },
  marker = 'synthetic',
) {
  return apiBackend.workHttp.intake.uploadDocument(
    memberScope(input.workspaceId, 'fixture'),
    {
      workId: brandWorkId(input.workId),
      filename: 'fixture.pdf',
      bytes: new TextEncoder().encode(`%PDF-1.7\n ${marker}`),
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

async function createChatActor(workspaceId: string) {
  const id = crypto.randomUUID();
  await db.user.create({
    data: {
      id,
      name: 'Fixture lawyer',
      email: id + '@example.test',
      memberships: { create: { workspaceId, role: 'member' } },
    },
  });
  return id;
}

test('chat shares the work session, waits for the current turn and retains read-only replies', async () => {
  const input = await create();
  const userId = await createChatActor(input.workspaceId);
  const scope = memberScope(input.workspaceId, userId);
  const { workId } = input;
  const chat = apiBackend.workHttp.chat;
  const readTimeline = () =>
    chat.list(scope, { workId, page: 1, pageSize: 15 });
  const waitForChat = async (
    ready: (timeline: Awaited<ReturnType<typeof readTimeline>>) => boolean,
  ) => {
    for (let check = 0; check < 300; check++) {
      const timeline = await readTimeline();
      if (ready(timeline)) return timeline;
      await Bun.sleep(50);
    }
    throw new Error('CHAT_STATUS_TIMEOUT');
  };
  const send = (userText: string) =>
    chat.send(scope, { workId, userText, correlationId: crypto.randomUUID() });
  const imagePath = 'images/chat-embedded.png';
  let source: Awaited<ReturnType<typeof upload>>;
  try {
    imageFixture = [
      {
        path: imagePath,
        contentType: 'image/png',
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      },
    ];
    source = await upload(input, 'chat source');
    await until(input, terminal);
  } finally {
    imageFixture = [];
  }
  expect(
    await workProcessing.sourceVisuals(
      input.workspaceId,
      workId,
      source.id,
      '0'.repeat(64),
    ),
  ).toEqual([]);
  const priorVisionCalls = describeCount;
  const initial = await db.workAgentSession.findFirstOrThrow({ where: input });
  const waiting = Promise.withResolvers<undefined>();
  const reached = Promise.withResolvers<undefined>();
  const firstQuestion =
    'Что стоит в поле имени и что на вложенном изображении?';
  const firstAnswer = 'В поле указано имя Анна. На изображении белый шкаф.';
  const followUpQuestion = 'Откуда взялось это имя?';
  const followUpAnswer = 'Из предыдущего ответа.';
  const traceDirectory = await mkdtemp(join(tmpdir(), 'anyko-chat-trace-'));
  const toolCall = (id: string, name: string, args: object) => ({
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  });
  const chatModel = createDocumentAgents({
    pool: actualPool,
    traceDirectory,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const request = new Request(url, init);
        const body = (await request.json()) as {
          messages: { role: string; content?: string }[];
          tools?: { function: { name: string } }[];
        };
        const prompt = JSON.stringify(body.messages);
        const lastMessage = [...body.messages]
          .reverse()
          .find(({ role }) => role === 'user')?.content;
        const lastQuestion = z
          .object({ message: z.string() })
          .parse(JSON.parse(lastMessage ?? '{}')).message;
        const isFollowUp = lastQuestion === followUpQuestion;
        const returnedTools = body.messages.filter(
          ({ role }) => role === 'tool',
        );
        const firstStep = !isFollowUp && !returnedTools.length;
        const askVisual = !isFollowUp && returnedTools.length === 3;
        expect(body.tools?.map(({ function: fn }) => fn.name).sort()).toEqual([
          'listImages',
          'readField',
          'readSource',
          'setWorkField',
        ]);
        expect(prompt).toContain('Сохранён контекст работы');
        if (firstStep) {
          expect(lastQuestion).toBe(firstQuestion);
          reached.resolve(undefined);
          await waiting.promise;
        } else if (isFollowUp) {
          expect(prompt).toContain(firstQuestion);
          expect(prompt).toContain(firstAnswer);
        } else if (askVisual) {
          expect(JSON.stringify(returnedTools)).toContain('Анна');
          expect(JSON.stringify(returnedTools)).toContain('Имя: Анна');
          expect(JSON.stringify(returnedTools)).toContain(imagePath);
        } else {
          expect(JSON.stringify(returnedTools)).toContain(
            'Белый шкаф с двумя дверцами.',
          );
        }
        return Response.json({
          id: 'fixture-chat',
          object: 'chat.completion',
          created: 1,
          model: 'fixture',
          usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
          choices: [
            {
              index: 0,
              message:
                firstStep || askVisual
                  ? {
                      role: 'assistant',
                      content: null,
                      tool_calls: askVisual
                        ? [
                            toolCall('visual', 'readSource', {
                              documentId: source.id,
                              imagePath,
                              offset: 0,
                            }),
                          ]
                        : [
                            toolCall('field', 'readField', {
                              field: 'personName',
                              offset: 0,
                            }),
                            toolCall('document', 'readSource', {
                              documentId: source.id,
                              imagePath: null,
                              offset: 0,
                            }),
                            toolCall('images', 'listImages', {
                              documentId: source.id,
                            }),
                          ],
                    }
                  : {
                      role: 'assistant',
                      content: isFollowUp ? followUpAnswer : firstAnswer,
                    },
              finish_reason: firstStep || askVisual ? 'tool_calls' : 'stop',
            },
          ],
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  chatHook = async (turn) => {
    if (turn.userText === firstQuestion) {
      expect(turn.previousContext?.summary).toBe('Сохранён контекст работы');
      expect(turn.facts.values.personName).toBe('Анна');
      expect(turn.messages).toEqual([]);
      expect(turn.documents.map(({ id }) => id)).toEqual([source.id]);
      await rejects(
        turn.readSource(crypto.randomUUID(), null),
        'SOURCE_NOT_ALLOWED',
      );
      await rejects(
        turn.readSource(source.id, 'images/unknown.png'),
        'SOURCE_NOT_ALLOWED',
      );
    } else {
      expect(turn.messages).toEqual([
        { userText: firstQuestion, answer: firstAnswer },
      ]);
    }
    return chatModel.chat(turn);
  };
  try {
    const accepted = await send(firstQuestion);
    await Promise.race([
      reached.promise,
      Bun.sleep(10000).then(() => {
        throw new Error('CHAT_NOT_STARTED');
      }),
    ]);
    const active = await readTimeline();
    expect(active.canSend).toBe(false);
    expect(active.items[0]).toMatchObject({
      runId: accepted.runId,
      kind: 'chat',
      status: 'running',
      userText: firstQuestion,
      answer: null,
    });
    await rejects(send('Вторая отправка'), 'WORK_BUSY');
    const added = await upload(input, 'during chat');
    await until(input, (view) =>
      view.documents.some(
        ({ id, status }) => id === added.id && status === 'succeeded',
      ),
    );
    expect(
      (await readTimeline()).items.filter(({ kind }) => kind === 'analysis'),
    ).toHaveLength(1);
    waiting.resolve(undefined);
    const completed = await waitForChat((timeline) =>
      timeline.items.some(
        ({ runId, answer }) =>
          runId === accepted.runId && answer === firstAnswer,
      ),
    );
    expect(
      completed.items.find(({ runId }) => runId === accepted.runId),
    ).toMatchObject({ answer: firstAnswer });
    const history = await apiBackend.workHttp.views.agentHistory(
      scope,
      workId,
      accepted.runId,
      1,
      10,
    );
    expect(history.items.filter(({ kind }) => kind === 'tool')).toHaveLength(4);
    expect(history.runUsage).toMatchObject({
      calls: 3,
      inputTokens: 21,
      outputTokens: 9,
    });
    const chatRun = await db.run.findUniqueOrThrow({
      where: { id: accepted.runId },
    });
    const traceFolder = join(traceDirectory, chatRun.correlationId);
    const traceFiles = await readdir(traceFolder);
    expect(traceFiles).toHaveLength(3);
    const records: unknown[] = await Promise.all(
      traceFiles
        .sort()
        .map(
          async (file) =>
            JSON.parse(
              await readFile(join(traceFolder, file), 'utf8'),
            ) as unknown,
        ),
    );
    expect(records.at(-1)).toMatchObject({
      stage: 'chat',
      finishReason: 'stop',
      parse: { status: 'accepted', answer: firstAnswer },
    });
    expect(describeCount).toBe(priorVisionCalls);
    await until(input, (view) => terminal(view) && view.runs.length === 2);
    const followUp = await send(followUpQuestion);
    const reopened = await waitForChat((timeline) =>
      timeline.items.some(
        ({ runId, answer }) => runId === followUp.runId && answer !== null,
      ),
    );
    expect(reopened.items[0]).toMatchObject({ answer: followUpAnswer });
    expect(reopened.items).toHaveLength(4);
    expect(
      (await db.workChatTurn.findMany({ where: input })).map(
        ({ sessionId }) => sessionId,
      ),
    ).toEqual([initial.id, initial.id]);
    expect((await until(input, terminal)).facts.values.personName).toBe('Анна');
    await apiBackend.workHttp.intake.removeDocument(scope, {
      workId,
      documentId: brandDocumentId(source.id),
    });
    await until(input, ({ cleanupPending }) => !cleanupPending);
    expect(await db.workChatTurn.count({ where: input })).toBe(0);
    expect(
      (await readTimeline()).items.some(({ kind }) => kind === 'chat'),
    ).toBe(false);
  } finally {
    waiting.resolve(undefined);
    chatHook = undefined;
    await chatModel.stop();
    await rm(traceDirectory, { recursive: true, force: true });
    await db.user.delete({ where: { id: userId } });
  }
});

test('chat links and unlinks a checklist source, records both changes, and rejects an unavailable source', async () => {
  const input = await create('bfl-bankruptcy-v7');
  const { workspaceId, workId } = input;
  const userId = await createChatActor(workspaceId);
  const app = fixtureApp(workspaceId, userId);
  const workUrl = `http://localhost/api/v1/workspaces/${workspaceId}/works/${workId}`;
  const request = (path: string, userText?: string) =>
    app.handle(
      new Request(workUrl + path, {
        method: userText ? 'POST' : 'GET',
        headers: {
          origin: apiBackend.workHttp.origin,
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: userText ? JSON.stringify({ userText }) : null,
      }),
    );
  const source = await upload(input, 'checklist chat source');
  const initial = await until(input, terminal);
  const file = initial.documents.find(({ id }) => id === source.id);
  if (!file) throw new Error('CHECKLIST_SOURCE_NOT_FOUND');
  const unavailable = crypto.randomUUID();
  const requirementKey = 'debt-certificate';
  const requirement = initial.checklist.find(
    ({ key }) => key === requirementKey,
  );
  if (!requirement) throw new Error('CHECKLIST_REQUIREMENT_NOT_FOUND');
  const read = async () => {
    const response = await request('');
    expect(response.status).toBe(200);
    return workResponseSchema.parse(await response.json());
  };
  const chatModel = createDocumentAgents({
    pool: actualPool,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const body = (await new Request(url, init).json()) as {
          messages: { role: string; content?: string }[];
          tools?: { function: { name: string } }[];
        };
        expect(body.tools?.map(({ function: fn }) => fn.name)).toContain(
          'setChecklistLink',
        );
        const lastUser = [...body.messages]
          .reverse()
          .find(({ role }) => role === 'user');
        const content = z
          .object({ message: z.string(), context: z.unknown() })
          .parse(JSON.parse(lastUser?.content ?? '{}'));
        expect(JSON.stringify(content.context)).toContain(requirementKey);
        const hasResult = body.messages.at(-1)?.role === 'tool';
        const args = {
          requirementKey:
            content.message === 'Неизвестный пункт'
              ? 'unknown'
              : requirementKey,
          documentId:
            content.message === 'Другой файл' ? unavailable : source.id,
          decision:
            content.message === 'Сними отметку' ? 'rejected' : 'confirmed',
        };
        return Response.json({
          id: 'fixture-checklist-edit',
          object: 'chat.completion',
          created: 1,
          model: 'fixture',
          choices: [
            {
              index: 0,
              finish_reason: hasResult ? 'stop' : 'tool_calls',
              message: hasResult
                ? { role: 'assistant', content: 'Обработано.' }
                : {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'checklist-edit',
                        type: 'function',
                        function: {
                          name: 'setChecklistLink',
                          arguments: JSON.stringify(args),
                        },
                      },
                    ],
                  },
            },
          ],
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  chatHook = (turn) => chatModel.chat(turn);
  try {
    const send = async (userText: string, status: string) => {
      const response = await request('/messages', userText);
      expect(response.status).toBe(202);
      const { runId } = z
        .object({ runId: z.uuid() })
        .parse(await response.json());
      let turnStatus: string | undefined;
      for (let poll = 0; poll < 300; poll++) {
        const timeline = await request('/messages?pageSize=15');
        expect(timeline.status).toBe(200);
        const { items } = z
          .object({
            items: z.array(z.object({ runId: z.uuid(), status: z.string() })),
          })
          .parse(await timeline.json());
        turnStatus = items.find((item) => item.runId === runId)?.status;
        if (turnStatus && !['queued', 'running'].includes(turnStatus)) break;
        await Bun.sleep(50);
      }
      expect(turnStatus).toBe(status);
      const history = await request(
        '/runs/' + runId + '/agent-history?pageSize=10',
      );
      expect(history.status).toBe(200);
      const { items } = getWorkAgentHistory.response.schema.parse(
        await history.json(),
      );
      return items.filter(({ kind }) => kind === 'tool');
    };
    const links = async () =>
      (await read()).checklist?.find(({ key }) => key === requirementKey)
        ?.sources;
    expect(await links()).toEqual([]);
    const confirmed = await send('Поставь отметку', 'succeeded');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({
      checklistChange: {
        requirementKey,
        requirementLabel: requirement.label,
        documentId: source.id,
        filename: file.filename,
        before: null,
        after: 'confirmed',
      },
    });
    expect(await links()).toMatchObject([
      { documentId: source.id, status: 'confirmed' },
    ]);
    await send('Поставь отметку повторно', 'succeeded');
    expect(await links()).toMatchObject([
      { documentId: source.id, status: 'confirmed' },
    ]);
    const rejected = await send('Сними отметку', 'succeeded');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      checklistChange: {
        requirementKey,
        documentId: source.id,
        filename: file.filename,
        before: 'confirmed',
        after: 'rejected',
      },
    });
    expect(await links()).toEqual([]);
    expect((await read()).documents.some(({ id }) => id === source.id)).toBe(
      true,
    );
    expect(await send('Другой файл', 'failed')).toMatchObject([
      { status: 'failed', errorCode: 'NOT_FOUND', checklistChange: null },
    ]);
    expect(await send('Неизвестный пункт', 'failed')).toMatchObject([
      {
        status: 'failed',
        errorCode: 'INVALID_WORK_INPUT',
        checklistChange: null,
      },
    ]);
    expect(await links()).toEqual([]);
  } finally {
    chatHook = undefined;
    await chatModel.stop();
    await db.user.delete({ where: { id: userId } });
  }
});

test('chat tool edits one field, records its history, and restores through the work route', async () => {
  const input = await create();
  const { workspaceId, workId } = input;
  const userId = await createChatActor(workspaceId);
  const app = fixtureApp(workspaceId, userId);
  const { workHttp } = apiBackend;
  const scope = memberScope(workspaceId, userId);
  const request = (path: string, method = 'GET', body?: unknown) =>
    app.handle(
      new Request(
        'http://localhost/api/v1/workspaces/' +
          workspaceId +
          '/works/' +
          workId +
          path,
        {
          method,
          headers: {
            origin: workHttp.origin,
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
          },
          body: body === undefined ? null : JSON.stringify(body),
        },
      ),
    );
  const send = async (userText: string) => {
    const response = await request('/messages', 'POST', { userText });
    expect(response.status).toBe(202);
    return z.object({ runId: z.uuid() }).parse(await response.json()).runId;
  };
  const waitForTurn = async (runId: string) => {
    for (let poll = 0; poll < 300; poll++) {
      const { items } = await workHttp.chat.list(scope, {
        workId,
        page: 1,
        pageSize: 15,
      });
      const turn = items.find((item) => item.runId === runId);
      if (turn && !['queued', 'running'].includes(turn.status)) return turn;
      await Bun.sleep(50);
    }
    throw new Error('CHAT_STATUS_TIMEOUT');
  };
  const second = pauseStep();
  const third = pauseStep();
  let firstSteps = 0;
  const chatModel = createDocumentAgents({
    pool: actualPool,
    fetch: Object.assign(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const body = z
          .object({
            messages: z.array(z.object({ role: z.string() })),
            tools: z
              .array(z.object({ function: z.object({ name: z.string() }) }))
              .optional(),
          })
          .parse(await new Request(url, init).json());
        const hasToolResult = body.messages.some(({ role }) => role === 'tool');
        if (!hasToolResult) {
          expect(body.tools?.map((tool) => tool.function.name)).toContain(
            'setWorkField',
          );
          firstSteps++;
          if (firstSteps === 2) {
            await second.wait();
          } else if (firstSteps === 3) {
            await third.wait();
          }
        } else if (firstSteps === 1) {
          const duringReply = await workHttp.views.get(scope, workId);
          expect(duringReply.facts.values.personName).toBe('Борис');
        } else if (firstSteps === 4) {
          return Response.json(
            { error: { message: 'Fixture provider denial' } },
            { status: 401 },
          );
        }
        return Response.json({
          id: 'fixture-field-edit',
          object: 'chat.completion',
          created: 1,
          model: 'fixture',
          choices: [
            {
              index: 0,
              finish_reason: hasToolResult ? 'stop' : 'tool_calls',
              message: hasToolResult
                ? { role: 'assistant', content: 'Готово.' }
                : {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'set-name',
                        type: 'function',
                        function: {
                          name: 'setWorkField',
                          arguments: JSON.stringify({
                            field: 'personName',
                            value: firstSteps === 1 ? 'Борис' : 'Вера',
                          }),
                        },
                      },
                    ],
                  },
            },
          ],
        });
      },
      { preconnect: fetch.preconnect },
    ),
  });
  chatHook = (turn) => chatModel.chat(turn);
  try {
    const source = await upload(input);
    const analyzed = await until(input, terminal);
    expect(analyzed.facts.values.personName).toBe('Анна');
    const extractionCalls = extractionCount;
    const chatText = 'Что сейчас указано в сведениях?';
    const runId = await send(chatText);
    expect(await waitForTurn(runId)).toMatchObject({
      kind: 'chat',
      userText: chatText,
      answer: 'Готово.',
      status: 'succeeded',
    });
    const changed = await workHttp.views.get(scope, workId);
    expect(changed.facts.values).toEqual({
      ...analyzed.facts.values,
      personName: 'Борис',
    });
    expect(changed.work.revision).toBe(analyzed.work.revision + 1);
    const historyResponse = await request(
      '/runs/' + runId + '/agent-history?pageSize=10',
    );
    expect(historyResponse.status).toBe(200);
    const { items } = getWorkAgentHistory.response.schema.parse(
      await historyResponse.json(),
    );
    const edits = items.filter((event) => event.fieldChange !== null);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      kind: 'tool',
      fieldChange: { field: 'personName', before: 'Анна', after: 'Борис' },
    });
    const eventId = edits[0]?.id;
    if (!eventId) throw new Error('FIELD_CHANGE_MISSING');
    const restore = { runId, eventId };
    const restoreAt = (revision: number, from = restore) =>
      request('/fields', 'PATCH', { revision, restore: from });
    expect((await restoreAt(analyzed.work.revision)).status).toBe(409);
    expect(
      (
        await request('/fields', 'PATCH', {
          revision: changed.work.revision,
          values: changed.facts.values,
          restore,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await restoreAt(changed.work.revision, {
          ...restore,
          runId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(404);
    const readOnly = memberScope(workspaceId, userId, ['works.read']);
    await rejects(
      workHttp.review.restoreField(readOnly, {
        workId,
        revision: changed.work.revision,
        ...restore,
      }),
      'FORBIDDEN',
    );

    const staleRun = await send('Поменяй ФИО.');
    await second.entered();
    await workHttp.review.editValues(scope, {
      workId,
      revision: changed.work.revision,
      values: { ...changed.facts.values, documentNumber: '42' },
    });
    second.release();
    expect(await waitForTurn(staleRun)).toMatchObject({
      status: 'failed',
      errorCode: 'REVISION_CONFLICT',
      answer: null,
    });
    const current = await workHttp.views.get(scope, workId);
    expect(current.facts.values).toMatchObject({
      personName: 'Борис',
      documentNumber: '42',
    });
    expect(current.work.revision).toBe(changed.work.revision + 1);
    const staleHistory = await workHttp.views.agentHistory(
      scope,
      workId,
      staleRun,
      1,
      10,
    );
    expect(
      staleHistory.items.find(({ kind }) => kind === 'tool'),
    ).toMatchObject({
      status: 'failed',
      errorCode: 'REVISION_CONFLICT',
      fieldChange: null,
    });

    const revokedRun = await send('Исправь имя на Вера.');
    await third.entered();
    await db.membership.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    third.release();
    expect(await waitForTurn(revokedRun)).toMatchObject({
      status: 'failed',
      errorCode: 'FORBIDDEN',
      answer: null,
    });
    const afterRevocation = await workHttp.views.get(scope, workId);
    expect(afterRevocation.work.revision).toBe(current.work.revision);
    expect(afterRevocation.facts.values.personName).toBe('Борис');
    const revokedHistory = await workHttp.views.agentHistory(
      scope,
      workId,
      revokedRun,
      1,
      10,
    );
    expect(
      revokedHistory.items.find(({ kind }) => kind === 'tool'),
    ).toMatchObject({
      status: 'failed',
      errorCode: 'FORBIDDEN',
      fieldChange: null,
    });
    await db.membership.create({
      data: { workspaceId, userId, role: 'member' },
    });

    expect((await restoreAt(current.work.revision)).status).toBe(200);
    const restored = await workHttp.views.get(scope, workId);
    expect(restored.facts.values).toMatchObject({
      personName: 'Анна',
      documentNumber: '42',
    });
    expect(restored.work.revision).toBe(current.work.revision + 1);

    const interruptedRun = await send(
      'Исправь имя на Вера. Потом сообщи результат.',
    );
    expect(await waitForTurn(interruptedRun)).toMatchObject({
      status: 'partial',
      errorCode: 'LLM_AUTH_FAILED',
      answer: null,
    });
    const interruptedLog = workLog
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find(
        (entry) =>
          entry.jobId === interruptedRun &&
          entry.event === 'work_processing_failed',
      );
    expect(interruptedLog).toMatchObject({
      errorCode: 'LLM_AUTH_FAILED',
      state: 'partial',
      attempt: 1,
      failure: {
        message: 'Провайдер модели отклонил авторизацию.',
        operation: 'work.chat',
      },
    });
    const interrupted = await workHttp.views.get(scope, workId);
    expect(interrupted.facts.values).toMatchObject({
      personName: 'Вера',
      documentNumber: '42',
    });
    expect(interrupted.work.revision).toBe(restored.work.revision + 1);
    const interruptedHistory = await workHttp.views.agentHistory(
      scope,
      workId,
      interruptedRun,
      1,
      10,
    );
    expect(
      interruptedHistory.items.find(({ kind }) => kind === 'tool')?.fieldChange,
    ).toMatchObject({
      field: 'personName',
      before: 'Анна',
      after: 'Вера',
    });

    expect(extractionCount).toBe(extractionCalls);
    expect(
      await db.run.count({
        where: { workspaceId, workId, kind: 'work.analysis' },
      }),
    ).toBe(1);
    await workHttp.intake.removeDocument(scope, {
      workId,
      documentId: brandDocumentId(source.id),
    });
    const cleaned = await until(input, ({ cleanupPending }) => !cleanupPending);
    expect((await restoreAt(cleaned.work.revision)).status).toBe(404);
  } finally {
    second.release();
    third.release();
    chatHook = undefined;
    await chatModel.stop();
    await db.user.delete({ where: { id: userId } });
  }
});

test('chat recovery cannot acknowledge a checklist confirmation superseded by a manual rejection', async () => {
  const input = await create('bfl-bankruptcy-v7');
  const { workspaceId, workId } = input;
  const userId = await createChatActor(workspaceId);
  const scope = memberScope(workspaceId, userId);
  const { chat, review, views } = apiBackend.workHttp;
  const source = await upload(input, 'recovered checklist source');
  const view = await until(input, terminal);
  const ocrRevision = view.documents.find(
    ({ id }) => id === source.id,
  )?.processingRevision;
  if (!ocrRevision) throw new Error('CHECKLIST_SOURCE_NOT_RECOGNISED');
  const args = {
    requirementKey: 'passport',
    documentId: source.id,
    decision: 'confirmed',
  } as const;
  const beforeRestart = pauseStep();
  let replay: unknown;
  let recovered: unknown;
  let deliveries = 0;
  chatHook = async (turn) => {
    if (!turn.checklist) throw new Error('EXPECTED_CHECKLIST_TOOL');
    deliveries++;
    if (deliveries === 1) {
      expect(
        await turn.checklist.write(args, 'first-confirm', turn.signal),
      ).toMatchObject({ after: 'confirmed' });
      await beforeRestart.wait();
    } else {
      recovered = turn.checklist.applied;
      replay = await turn.checklist.write(
        args,
        'replayed-confirm',
        turn.signal,
      );
    }
    return {
      answer: 'Готово.',
      usage: { inputTokens: null, outputTokens: null },
    };
  };
  try {
    if (!worker) throw new Error('EXPECTED_RUNNING_WORKER');
    const { runId } = await chat.send(scope, {
      workId,
      userText: 'Подтверди паспорт.',
      correlationId: crypto.randomUUID(),
    });
    await beforeRestart.entered();
    await review.editChecklistLink(scope, {
      ...args,
      workId,
      documentId: brandDocumentId(source.id),
      ocrRevision,
      decision: 'rejected',
    });
    const draining = worker.stop();
    await db.run.update({
      where: { id: runId },
      data: { leaseUntil: new Date(0) },
    });
    beforeRestart.release();
    await draining;
    await workerBackend.jobs.reconcile();
    worker = await startJobWorker(workerBackend.jobs, {
      prefix: workerPrefix + '-checklist-restarted',
    });

    const deadline = Date.now() + 15_000;
    for (;;) {
      const { items } = await chat.list(scope, {
        workId,
        page: 1,
        pageSize: 15,
      });
      const entry = items.find((item) => item.runId === runId);
      if (entry && !['queued', 'running'].includes(entry.status)) {
        expect(entry).toMatchObject({
          status: 'partial',
          errorCode: 'REVISION_CONFLICT',
          answer: null,
        });
        break;
      }
      if (Date.now() >= deadline) throw new Error('CHAT_RECOVERY_TIMEOUT');
      await Bun.sleep(50);
    }
    expect(deliveries).toBe(2);
    expect(recovered).toEqual([]);
    expect(replay).toEqual({ errorCode: 'REVISION_CONFLICT' });
    const after = await views.get(scope, workId);
    expect(
      after.checklist.find(({ key }) => key === 'passport')?.sources,
    ).toEqual([]);
  } finally {
    beforeRestart.release();
    chatHook = undefined;
    await db.user.delete({ where: { id: userId } });
  }
}, 30_000);

test('recovery of a chat turn does not reapply a field value superseded before restart', async () => {
  const { workspaceId, workId } = await create();
  const userId = await createChatActor(workspaceId);
  const scope = memberScope(workspaceId, userId);
  const { chat, views } = apiBackend.workHttp;
  const initial = await views.get(scope, workId);
  const beforeRestart = pauseStep();
  let deliveries = 0;
  chatHook = async (turn) => {
    deliveries++;
    const write = (value: string, callId: string) =>
      turn.writeField({ field: 'personName', value }, callId, turn.signal);
    if (deliveries === 1) {
      expect(await write('Анна', 'first-name')).toMatchObject({
        before: null,
        after: 'Анна',
      });
      expect(await write('Борис', 'second-name')).toMatchObject({
        before: 'Анна',
        after: 'Борис',
      });
      await beforeRestart.wait();
    } else {
      expect(turn.appliedFields).toContain('personName');
      expect(await write('Анна', 'replayed-with-a-new-provider-id')).toEqual({
        errorCode: 'REVISION_CONFLICT',
      });
      expect(
        await write('Борис', 'latest-replayed-with-a-new-provider-id'),
      ).toMatchObject({
        before: 'Анна',
        after: 'Борис',
      });
    }
    return {
      answer: 'История обработана.',
      usage: { inputTokens: null, outputTokens: null },
    };
  };
  try {
    if (!worker) throw new Error('EXPECTED_RUNNING_WORKER');
    const { runId } = await chat.send(scope, {
      workId,
      userText: 'Исправь ФИО.',
      correlationId: crypto.randomUUID(),
    });
    await beforeRestart.entered();
    const before = await views.get(scope, workId);
    expect(before.facts.values.personName).toBe('Борис');
    expect(before.work.revision).toBe(initial.work.revision + 2);
    const draining = worker.stop();
    await db.run.update({
      where: { id: runId },
      data: { leaseUntil: new Date(0) },
    });
    beforeRestart.release();
    await draining;
    await workerBackend.jobs.reconcile();
    expect(
      await db.runOutbox.findUniqueOrThrow({ where: { runId } }),
    ).toMatchObject({ deliveredAt: null });
    worker = await startJobWorker(workerBackend.jobs, {
      prefix: workerPrefix + '-chat-restarted',
    });
    const deadline = Date.now() + 15_000;
    for (;;) {
      const { items } = await chat.list(scope, {
        workId,
        page: 1,
        pageSize: 15,
      });
      const entry = items.find((item) => item.runId === runId);
      if (entry && !['queued', 'running'].includes(entry.status)) {
        expect(entry).toMatchObject({
          status: 'partial',
          errorCode: 'REVISION_CONFLICT',
          answer: null,
        });
        break;
      }
      if (Date.now() >= deadline) throw new Error('CHAT_RECOVERY_TIMEOUT');
      await Bun.sleep(50);
    }
    expect(deliveries).toBe(2);
    const after = await views.get(scope, workId);
    expect(after.facts.values.personName).toBe('Борис');
    expect(after.work.revision).toBe(before.work.revision);
    const history = await views.agentHistory(scope, workId, runId, 1, 10);
    const fieldChanges = history.items.flatMap(({ fieldChange }) =>
      fieldChange ? [fieldChange] : [],
    );
    expect(fieldChanges.sort((a, b) => a.revision - b.revision)).toMatchObject([
      { field: 'personName', before: null, after: 'Анна' },
      { field: 'personName', before: 'Анна', after: 'Борис' },
    ]);
  } finally {
    beforeRestart.release();
    chatHook = undefined;
    await db.user.delete({ where: { id: userId } });
  }
}, 30_000);

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
  await rejects(
    runtime.deps.documents.commands.remove(
      memberScope(input.workspaceId),
      brandDocumentId(doc.id),
    ),
    'DOCUMENT_IN_USE',
  );
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

test('a shared source pins the latest ready OCR in each work and survives unlinking', async () => {
  const input = await create();
  const foreign = await create();
  const scope = memberScope(input.workspaceId);
  const foreignDoc = await upload(foreign);
  await until(foreign, (view) => view.documents[0]?.status === 'succeeded');
  await until(foreign, (view) => view.documents[0]?.status === 'succeeded');
  const intake = apiBackend.workHttp.intake;
  const documents = apiBackend.documentHttp.documents;
  const destination = await intake.createWork(scope, {
    packageVersion: 'technical-document-v1',
    title: 'Другая работа',
  });
  const target = { ...input, workId: destination };
  let analyzedText = '';
  const ocr = pauseStep();
  const image = new Uint8Array([1, 2, 3, 4]);
  parseFixture = async () => {
    await ocr.wait();
    return {
      markdown: 'Имя: Анна. Номер: 42.',
      processorVersion: 'fixture',
      images: [
        { path: 'images/page.png', contentType: 'image/png', bytes: image },
      ],
    };
  };
  let documentId: ReturnType<typeof brandDocumentId>;
  try {
    documentId = brandDocumentId((await upload(input)).id);
    await ocr.entered();
    const catalog = await documents.queries.list(scope, { limit: 20 });
    expect(
      catalog.items.find(({ id }) => id === documentId)?.readyRevision,
    ).toBeNull();
    await rejects(
      intake.attachDocuments(scope, {
        workId: destination,
        documentIds: [documentId],
      }),
      'NOT_READY',
    );
  } finally {
    ocr.release();
    parseFixture = undefined;
  }
  await until(input, (view) => view.documents[0]?.status === 'succeeded');
  const waiting = pauseStep();
  parseFixture = async () => {
    await waiting.wait();
    return {
      markdown: 'Новая версия распознавания.',
      processorVersion: 'fixture',
      images: [],
    };
  };
  try {
    await documents.commands.retry(scope, documentId, crypto.randomUUID());
    await waiting.entered();
    const [ready] = (await documents.queries.list(scope, { limit: 20 })).items;
    expect(ready).toMatchObject({
      id: documentId,
      status: 'running',
      readyRevision: 1,
    });
    await rejects(
      intake.attachDocuments(scope, {
        workId: destination,
        documentIds: [documentId, foreignDoc.id],
      }),
      'NOT_READY',
    );
    expect(
      (await apiBackend.workHttp.views.get(scope, destination)).documents,
    ).toEqual([]);
    extractFixture = (args) => {
      if (args.resource === `${input.workspaceId}:${destination}`)
        analyzedText = args.document.text;
      return Promise.resolve({
        candidates: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    };
    await intake.attachDocuments(scope, {
      workId: destination,
      documentIds: [documentId],
    });
    const linked = await apiBackend.workHttp.views.get(scope, destination);
    expect(linked.documents[0]).toMatchObject({
      id: documentId,
      status: 'succeeded',
      processingRevision: 1,
    });
    await intake.attachDocuments(scope, {
      workId: destination,
      documentIds: [documentId],
    });
    expect(
      (await apiBackend.workHttp.views.get(scope, destination)).work
        .inputRevision,
    ).toBe(linked.work.inputRevision);
  } finally {
    waiting.release();
    parseFixture = undefined;
  }
  const deadline = Date.now() + 10000;
  while (
    (await documents.queries.get(scope, documentId)).status !== 'succeeded'
  ) {
    if (Date.now() > deadline) throw new Error('RETRY_NOT_READY');
    await Bun.sleep(30);
  }
  expect((await documents.queries.result(scope, documentId)).markdown).toBe(
    'Новая версия распознавания.',
  );
  for (const workId of [input.workId, destination]) {
    expect(
      (await apiBackend.workHttp.views.result(scope, workId, documentId))
        .markdown,
    ).toBe('Имя: Анна. Номер: 42.');
    expect(
      (await apiBackend.workHttp.views.image(scope, workId, documentId, 0))
        .bytes,
    ).toEqual(image);
  }
  try {
    expect((await until(target, terminal)).runs[0]?.status).toBe('succeeded');
    expect(analyzedText).toBe('Имя: Анна. Номер: 42.');
  } finally {
    extractFixture = undefined;
  }
  await rejects(
    documents.commands.remove(scope, documentId),
    'DOCUMENT_IN_USE',
  );
  await intake.removeDocument(scope, { workId: input.workId, documentId });
  await until(input, (view) => !view.cleanupPending && !view.documents.length);
  expect(
    (await apiBackend.workHttp.views.result(scope, destination, documentId))
      .markdown,
  ).toBe('Имя: Анна. Номер: 42.');
  expect(
    (await documents.queries.get(scope, documentId)).processingRevision,
  ).toBe(2);
}, 35000);

test('updating OCR in one work preserves the other pin and marks only unsupported facts for review', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const { intake, views, review, generation } = apiBackend.workHttp;
  const catalog = apiBackend.documentHttp.documents;
  const stableText = 'Дата: 01.06.2020.';
  const original = `Имя: Анна. Номер: 100\n${stableText}`;
  const revised = `Номер: 1000\nНомер: -100\n${stableText}`;
  parseFixture = () =>
    Promise.resolve({ markdown: original, processorVersion: 'fixture' });
  try {
    extractFixture = ({ document }) =>
      Promise.resolve({
        candidates: [
          {
            field: 'personName',
            value: 'Анна',
            evidence: [
              { documentId: document.id, imagePath: null, quote: 'Имя: Анна.' },
            ],
          },
          {
            field: 'documentDate',
            value: '2020-06-01',
            evidence: [
              { documentId: document.id, imagePath: null, quote: stableText },
            ],
          },
          {
            field: 'documentNumber',
            value: '100',
            evidence: [
              { documentId: document.id, imagePath: null, quote: '100' },
            ],
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1 },
      });
    const documentId = brandDocumentId((await upload(input)).id);
    await until(input, (view) => view.documents[0]?.status === 'succeeded');
    const other = await intake.createWork(scope, {
      packageVersion: 'technical-document-v1',
      title: 'Другая работа с тем же файлом',
      documentIds: [documentId],
    });
    const analyzed = await until(input, terminal);
    expect(analyzed.facts.values).toMatchObject({
      personName: 'Анна',
      documentNumber: '100',
      documentDate: '01.06.2020',
    });
    await review.confirmFacts(scope, {
      workId: input.workId,
      revision: analyzed.work.revision,
    });
    parseFixture = () =>
      Promise.resolve({ markdown: revised, processorVersion: 'fixture' });
    await catalog.commands.retry(scope, documentId, crypto.randomUUID());
    const deadline = Date.now() + 10000;
    while (
      (await catalog.queries.get(scope, documentId)).status !== 'succeeded'
    ) {
      if (Date.now() > deadline) throw new Error('RETRY_NOT_READY');
      await Bun.sleep(30);
    }
    const update = { workId: input.workId, documentId, ocrRevision: 2 };
    await rejects(
      intake.updateRecognition(
        memberScope(input.workspaceId, 'read-only', ['works.read']),
        update,
      ),
      'FORBIDDEN',
    );
    await rejects(
      intake.updateRecognition(scope, { ...update, ocrRevision: 99 }),
      'NOT_READY',
    );
    expect((await views.result(scope, input.workId, documentId)).markdown).toBe(
      original,
    );
    await intake.updateRecognition(scope, update);
    const changed = await views.get(scope, input.workId);
    expect((await views.result(scope, input.workId, documentId)).markdown).toBe(
      revised,
    );
    expect((await views.result(scope, other, documentId)).markdown).toBe(
      original,
    );
    await rejects(
      views.result(scope, input.workId, documentId, 1),
      'NOT_READY',
    );
    await rejects(
      views.image(scope, input.workId, documentId, 0, 1),
      'NOT_READY',
    );
    expect(changed.facts.values).toMatchObject({
      personName: 'Анна',
      documentNumber: '100',
      documentDate: '01.06.2020',
    });
    expect(changed.facts.needsReview?.slice().sort()).toEqual([
      'documentNumber',
      'personName',
    ]);
    expect(changed.facts.confirmed).toContain('documentDate');
    expect(changed.facts.confirmed).not.toContain('personName');
    expect(changed.facts.candidates.map(({ field }) => field)).toEqual([
      'documentDate',
    ]);
    expect(changed.runs.map(({ id }) => id)).toEqual(
      analyzed.runs.map(({ id }) => id),
    );
    await intake.updateRecognition(scope, update);
    expect((await views.get(scope, input.workId)).work.revision).toBe(
      changed.work.revision,
    );
    await rejects(
      generation.startGeneration(scope, {
        workId: input.workId,
        revision: changed.work.revision,
        correlationId: crypto.randomUUID(),
      }),
      'NOT_READY',
    );
    await review.confirmFacts(scope, {
      workId: input.workId,
      revision: changed.work.revision,
    });
    expect((await views.get(scope, input.workId)).facts.needsReview).toEqual(
      [],
    );
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
}, 30000);

test('global source deletion confirms live links, refuses running works, and keeps generated history and values', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const member = memberScope(input.workspaceId, 'member', [
    'recognitions.use',
    'works.read',
  ]);
  const { views, review, generation } = apiBackend.workHttp;
  const catalog = apiBackend.documentHttp.documents;
  const pause = pauseStep();
  waitForExtraction = ({ resource }) =>
    resource === `${input.workspaceId}:${input.workId}`
      ? pause.wait()
      : Promise.resolve();
  const documentId = brandDocumentId((await upload(input)).id);
  await until(input, (state) => state.documents[0]?.status === 'succeeded');
  const original = await catalog.queries.deletionImpact(scope, documentId);
  const app = fixtureApp(input.workspaceId);
  const key = crypto.randomUUID();
  const createAttachedWork = () =>
    app.handle(
      new Request(
        `http://localhost/api/v1/workspaces/${input.workspaceId}/works`,
        {
          method: 'POST',
          headers: {
            origin: apiBackend.workHttp.origin,
            'content-type': 'application/json',
            'idempotency-key': key,
          },
          body: JSON.stringify({
            title: 'Новая связь',
            packageVersion: 'technical-document-v1',
            documentIds: [documentId],
          }),
        },
      ),
    );
  const creation = await createAttachedWork();
  expect(creation.status).toBe(201);
  const created = z
    .object({
      work: z.object({ id: z.uuid() }),
      documents: z.array(z.object({ id: z.uuid() })),
    })
    .parse(await creation.json());
  const other = brandWorkId(created.work.id);
  expect(created.documents).toEqual([{ id: documentId }]);
  expect(
    await db.idempotencyKey.findFirst({
      where: { workspaceId: input.workspaceId, key },
      select: { resourceId: true, resourceDocumentIds: true },
    }),
  ).toEqual({ resourceId: other, resourceDocumentIds: [documentId] });
  await rejects(
    catalog.commands.remove(scope, documentId, original.token),
    'REVISION_CONFLICT',
  );
  const impact = await catalog.queries.deletionImpact(scope, documentId);
  expect(impact.works.map(({ title }) => title).sort()).toEqual([
    'Новая связь',
    'Тестовая работа',
  ]);
  expect(
    (await catalog.queries.deletionImpact(member, documentId)).canDelete,
  ).toBe(false);
  await rejects(
    catalog.commands.remove(member, documentId, impact.token),
    'FORBIDDEN',
  );
  try {
    await pause.entered();
    expect(
      (await catalog.queries.deletionImpact(scope, documentId)).works.find(
        ({ id }) => id === input.workId,
      )?.busy,
    ).toBe(true);
    await rejects(
      catalog.commands.remove(scope, documentId, impact.token),
      'WORK_BUSY',
    );
  } finally {
    pause.release();
    waitForExtraction = undefined;
  }
  const analyzed = await until(input, terminal);
  await until({ ...input, workId: other }, terminal);
  await review.confirmFacts(scope, {
    workId: input.workId,
    revision: analyzed.work.revision,
  });
  const confirmed = await views.get(scope, input.workId);
  const rendering = pauseStep();
  pauseGeneratedWrite = () => rendering.wait();
  try {
    await generation.startGeneration(scope, {
      workId: input.workId,
      revision: confirmed.work.revision,
      correlationId: crypto.randomUUID(),
    });
    await rendering.entered();
    await rejects(
      catalog.commands.remove(scope, documentId, impact.token),
      'WORK_BUSY',
    );
  } finally {
    rendering.release();
    pauseGeneratedWrite = undefined;
  }
  const generated = await until(
    input,
    (state) => state.generations[0]?.status === 'succeeded',
  );
  const history = generated.generations[0];
  const file = history?.files[0];
  if (!history || !file) throw new Error('Expected generated history');
  const affectedThreadIds = await workProcessing.threads(
    input.workspaceId,
    input.workId,
  );
  expect(affectedThreadIds.some((id) => threads.has(id))).toBe(true);
  const otherThread = crypto.randomUUID();
  await workProcessing.thread(input.workspaceId, other, otherThread);
  threads.add(otherThread);
  await catalog.commands.remove(scope, documentId, impact.token);
  await rejects(catalog.queries.get(scope, documentId), 'NOT_FOUND');
  await rejects(catalog.queries.source(scope, documentId), 'NOT_FOUND');
  await rejects(catalog.queries.result(scope, documentId), 'NOT_FOUND');
  await rejects(views.source(scope, other, documentId), 'NOT_FOUND');
  await rejects(views.result(scope, other, documentId), 'NOT_FOUND');
  const replay = await createAttachedWork();
  expect(replay.status).toBe(404);
  expect(await replay.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  expect((await views.get(scope, other)).documents).toEqual([]);
  const changed = await views.get(scope, input.workId);
  expect(changed.documents).toEqual([]);
  expect(changed.facts.values.personName).toBe('Анна');
  expect(changed.facts.needsReview).toEqual(['personName']);
  expect(changed.facts.candidates).toEqual([]);
  expect(changed.generations[0]?.id).toBe(history.id);
  const deadline = Date.now() + 15000;
  while (
    (await catalog.queries.deletion(scope, documentId)).status !== 'deleted'
  ) {
    if (Date.now() > deadline) throw new Error('Deletion did not finish');
    await Bun.sleep(30);
  }
  expect(await workProcessing.threads(input.workspaceId, input.workId)).toEqual(
    [],
  );
  expect(await workProcessing.threads(input.workspaceId, other)).toEqual([]);
  expect(
    [...affectedThreadIds, otherThread].some((id) => threads.has(id)),
  ).toBe(false);
  const output = await generation.downloadResult(scope, {
    workId: brandWorkId(input.workId),
    generationId: brandGenerationId(history.id),
  });
  expect(output.bytes.byteLength).toBeGreaterThan(0);
  await rejects(
    generation.startGeneration(scope, {
      workId: input.workId,
      revision: changed.work.revision,
      correlationId: crypto.randomUUID(),
    }),
    'NOT_READY',
  );
  await review.confirmFacts(scope, {
    workId: input.workId,
    revision: changed.work.revision,
  });
  const reviewed = await views.get(scope, input.workId);
  await generation.startGeneration(scope, {
    workId: input.workId,
    revision: reviewed.work.revision,
    correlationId: crypto.randomUUID(),
  });
  const regenerated = await until(input, (state) =>
    state.generations.some(
      (item) => item.id !== history.id && item.status === 'succeeded',
    ),
  );
  expect(regenerated.generations).toHaveLength(2);
}, 35000);

test('work creation rolls back a stale catalog selection and pins ready sources on retry', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const source = await upload(input);
  await until(input, (view) => view.documents[0]?.status === 'succeeded');
  const where = { workspaceId: input.workspaceId };
  const before = await db.work.count({ where });
  const sessions = await db.workAgentSession.count({ where });
  const intake = apiBackend.workHttp.intake;
  const options = {
    title: 'Работа из каталога',
    packageVersion: 'technical-document-v1',
  };

  await rejects(
    intake.createWork(scope, {
      ...options,
      documentIds: [source.id, crypto.randomUUID()],
    }),
    'NOT_READY',
  );
  expect(await db.work.count({ where })).toBe(before);
  expect(await db.workAgentSession.count({ where })).toBe(sessions);

  const workId = await intake.createWork(scope, {
    ...options,
    documentIds: [source.id],
  });
  const view = await until(
    { ...input, workId },
    (current) => current.documents.length === 1,
  );
  expect(view.documents[0]).toMatchObject({
    id: source.id,
    processingRevision: 1,
  });
  expect(view.runs).toEqual([]);
});

test('work upload responses cannot be replayed after unlinking while the catalog file remains', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const intake = apiBackend.workHttp.intake;
  const other = await intake.createWork(scope, {
    title: 'Вторая работа',
    packageVersion: 'technical-document-v1',
  });
  const uploadInput = {
    workId: input.workId,
    requestKey: crypto.randomUUID(),
    filename: 'тот же файл.pdf',
    correlationId: crypto.randomUUID(),
    bytes: new TextEncoder().encode('%PDF-1.7\n synthetic'),
  };
  const source = await intake.uploadDocument(scope, uploadInput);
  const independent = await intake.uploadDocument(scope, {
    ...uploadInput,
    workId: other,
  });
  expect(independent.id).not.toBe(source.id);
  const documents = apiBackend.documentHttp.documents;
  const cache = apiBackend.workHttp.idempotency;
  const ref = {
    workspaceId: input.workspaceId,
    command: 'POST /workspaces/:workspaceId/works/:workId/documents',
    key: uploadInput.requestKey,
    fingerprint: 'synthetic',
  };
  const response = () =>
    Promise.resolve({
      response: { status: 202, body: JSON.stringify({ document: source }) },
      resource: { kind: 'document' as const, id: source.id },
    });
  expect(await cache.run(ref, response)).toMatchObject({
    kind: 'response',
    response: { status: 202 },
  });
  await intake.removeDocument(scope, {
    workId: input.workId,
    documentId: brandDocumentId(source.id),
  });
  expect(await cache.run(ref, response)).toMatchObject({
    kind: 'resource_unavailable',
    replayed: true,
  });
  const late = { ...ref, key: crypto.randomUUID() };
  await cache.run(late, response);
  expect(await cache.run(late, response)).toMatchObject({
    kind: 'resource_unavailable',
    replayed: true,
  });
  expect(
    (await documents.queries.get(scope, brandDocumentId(source.id))).id,
  ).toBe(source.id);
  expect(
    (await apiBackend.workHttp.views.get(scope, other)).documents[0]?.id,
  ).toBe(independent.id);
});

test('a package generates three individually scoped DOCX files from one snapshot and unlinking erases the whole set', async () => {
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
  const uploaded = await until(input, terminal);
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
    await upload(input);
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
  failExtraction = true;
  try {
    await upload(input);
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

test('a mixed upload group analyzes readable files and a successful OCR retry joins a later group', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const heldOcr = pauseStep();
  const heldAgent = pauseStep();
  let fail = true;
  const requests: { sessionId: string; ids: string[] }[] = [];
  parseFixture = async (bytes) => {
    const marker = new TextDecoder().decode(bytes);
    if (marker.endsWith('held')) await heldOcr.wait();
    if (fail && marker.endsWith('retry')) throw new Error('OCR_FAILED');
    return { markdown: 'Имя: Анна. Номер: 42.', processorVersion: 'fixture' };
  };
  reconcileHook = async ({ sessionId, documents }) => {
    requests.push({ sessionId, ids: documents.map(({ id }) => id).sort() });
    if (requests.length === 1) await heldAgent.wait();
    return {
      summary: 'Группа принята',
      candidates: [],
      usage: { inputTokens: 3, outputTokens: 2 },
    };
  };
  try {
    const first = await upload(input, 'held');
    await heldOcr.entered();
    const second = await upload(input, 'retry');
    await until(input, (view) => view.pendingUploadCount === 2);
    expect(await db.workUploadGroup.count({ where: input })).toBe(1);
    heldOcr.release();
    await until(
      input,
      (view) =>
        view.documents.some(
          (item) => item.id === first.id && item.status === 'succeeded',
        ) &&
        view.documents.some(
          (item) => item.id === second.id && item.status === 'failed',
        ),
    );
    await until(input, (view) =>
      view.runs.some(({ status }) => status === 'running'),
    );
    await heldAgent.entered();
    const third = await upload(input, 'next');
    const waiting = await until(input, (view) =>
      view.documents.some(
        (item) => item.id === third.id && item.status === 'succeeded',
      ),
    );
    expect(waiting.pendingUploadCount).toBe(1);
    expect(waiting.runs).toMatchObject([
      { kind: 'analysis', status: 'running' },
    ]);
    expect(requests.map(({ ids }) => ids)).toEqual([[first.id]]);
    heldAgent.release();
    await until(input, (view) => view.runs.length === 2 && terminal(view));
    fail = false;
    await apiBackend.documentHttp.documents.commands.retry(
      scope,
      brandDocumentId(second.id),
      crypto.randomUUID(),
    );
    const completed = await until(
      input,
      (view) => view.runs.length === 3 && terminal(view),
    );
    expect(completed.runs.map(({ status }) => status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
    ]);
    const sessionId = completed.session?.id;
    if (!sessionId) throw new Error('EXPECTED_WORK_SESSION');
    expect(requests).toEqual([
      { sessionId, ids: [first.id] },
      { sessionId, ids: [first.id, third.id].sort() },
      {
        sessionId,
        ids: [first.id, second.id, third.id].sort(),
      },
    ]);
    const groups = await db.workUploadGroup.findMany({
      where: input,
      orderBy: { id: 'asc' },
      include: { documents: true },
    });
    expect(
      groups.map(({ documents }) =>
        documents.map(({ documentId }) => documentId).sort(),
      ),
    ).toEqual([[first.id], [third.id], [second.id]]);
    expect(
      groups.every(({ closedAt, dispatchedAt }) => closedAt && dispatchedAt),
    ).toBe(true);
  } finally {
    heldOcr.release();
    heldAgent.release();
    parseFixture = undefined;
    reconcileHook = undefined;
  }
}, 20000);

test('a failed source can be removed after the readable file was analyzed', async () => {
  const input = await create();
  const held = pauseStep();
  parseFixture = async (bytes) => {
    if (new TextDecoder().decode(bytes).endsWith('unreadable'))
      throw new Error('OCR_FAILED');
    await held.wait();
    return { markdown: 'Имя: Анна. Номер: 42.', processorVersion: 'fixture' };
  };
  try {
    const good = await upload(input, 'good');
    await held.entered();
    const bad = await upload(input, 'unreadable');
    held.release();
    await until(
      input,
      (view) =>
        view.documents.some(
          ({ id, status }) => id === good.id && status === 'succeeded',
        ) &&
        view.documents.some(
          ({ id, status }) => id === bad.id && status === 'failed',
        ),
    );
    const analyzed = await until(input, terminal);
    expect(analyzed.facts.values.personName).toBe('Анна');
    await apiBackend.workHttp.intake.removeDocument(
      memberScope(input.workspaceId),
      {
        workId: input.workId,
        documentId: brandDocumentId(bad.id),
      },
    );
    const completed = await until(input, (view) =>
      view.documents.every(({ id }) => id !== bad.id),
    );
    expect(completed.documents.map(({ id }) => id)).toEqual([good.id]);
    expect(completed.runs).toMatchObject([
      { kind: 'analysis', status: 'succeeded' },
    ]);
    expect(completed.facts.values.personName).toBe('Анна');
  } finally {
    held.release();
    parseFixture = undefined;
  }
}, 15000);

test('an all-failed upload group dispatches without repeating a previous analysis', async () => {
  const input = await create();
  const extraction = pauseStep();
  failExtraction = true;
  waitForExtraction = ({ resource }) =>
    resource === `${input.workspaceId}:${input.workId}`
      ? extraction.wait()
      : Promise.resolve();
  parseFixture = (bytes) => {
    if (new TextDecoder().decode(bytes).endsWith('unreadable'))
      return Promise.reject(new Error('OCR_FAILED'));
    return Promise.resolve({
      markdown: 'Имя: Анна. Номер: 42.',
      processorVersion: 'fixture',
    });
  };
  try {
    const first = await upload(input, 'first');
    await extraction.entered();
    const second = await upload(input, 'unreadable');
    await until(input, (view) =>
      view.documents.some(
        ({ id, status }) => id === second.id && status === 'failed',
      ),
    );
    extraction.release();
    const failed = await until(
      input,
      (view) =>
        view.runs[0]?.status === 'failed' && view.pendingUploadCount === 0,
    );
    expect(failed.runs).toHaveLength(1);
    expect(failed.availability.analyze).toEqual({ available: true });
    failExtraction = false;
    await analyze(input);
    const recovered = await until(
      input,
      (view) => view.runs.length === 2 && view.runs[0]?.status === 'succeeded',
    );
    expect(recovered.pendingUploadCount).toBe(0);
    expect(recovered.runs.map(({ status }) => status)).toEqual([
      'succeeded',
      'failed',
    ]);
    expect(recovered.documents.find(({ id }) => id === second.id)?.status).toBe(
      'failed',
    );
    const runs = await db.run.findMany({
      where: { ...input, kind: 'work.analysis' },
      select: { documentIds: true },
    });
    expect(runs.map(({ documentIds }) => documentIds)).toEqual([
      [first.id],
      [first.id],
    ]);
    expect(
      await db.run.count({
        where: { workspaceId: input.workspaceId, documentId: second.id },
      }),
    ).toBe(1);
  } finally {
    extraction.release();
    failExtraction = false;
    waitForExtraction = undefined;
    parseFixture = undefined;
  }
}, 15000);

test('a legacy unread source without an OCR run closes its group before another attachment', async () => {
  const input = await create();
  const actor = 'fixture';
  const legacyId = crypto.randomUUID();
  await db.sourceDocument.create({
    data: {
      id: legacyId,
      workspaceId: input.workspaceId,
      filename: 'legacy.pdf',
      sourceKey: `fixture/${legacyId}.pdf`,
      sourceChecksum: 'fixture',
      requestKey: crypto.randomUUID(),
      size: 1,
      createdBy: actor,
    },
  });
  await db.$transaction(async (tx) => {
    const group = await tx.workUploadGroup.create({
      data: { ...input, actorId: actor },
    });
    await tx.workDocument.create({
      data: {
        ...input,
        documentId: legacyId,
        uploadGroupId: group.id,
        uploaded: true,
      },
    });
  });
  await until(input, (view) =>
    view.documents.some(
      ({ id, errorCode, status }) =>
        id === legacyId &&
        status === 'failed' &&
        errorCode === 'OCR_RETRY_REQUIRED',
    ),
  );
  const next = await upload(input, 'next');
  const groups = await db.workUploadGroup.findMany({
    where: input,
    orderBy: { id: 'asc' },
    include: { documents: true },
  });
  expect(
    groups.map(({ documents }) =>
      documents.map(({ documentId }) => documentId),
    ),
  ).toEqual([[legacyId], [next.id]]);
  expect(groups[0]?.closedAt).toBeInstanceOf(Date);
  await until(
    input,
    (view) =>
      view.pendingUploadCount === 0 &&
      view.documents.some(
        ({ id, status }) => id === next.id && status === 'succeeded',
      ),
  );
  const runs = await db.run.findMany({
    where: { ...input, kind: 'work.analysis' },
    select: { documentIds: true },
  });
  expect(runs.map(({ documentIds }) => documentIds)).toEqual([[next.id]]);
}, 15000);

test('a dispatched upload analysis is redelivered with the same run after the queue is lost', async () => {
  const input = await create();
  if (!worker) throw new Error('EXPECTED_RUNNING_WORKER');
  await worker.stop();
  worker = await startJobWorker(workerBackend.jobs, {
    prefix: workerPrefix,
    queues: 'ocr,maintenance',
  });
  const source = await upload(input, 'before-restart');
  const enqueued = await until(input, async (view) => {
    const run = view.runs[0];
    if (!run || run.status !== 'queued') return false;
    const outbox = await db.runOutbox.findUnique({ where: { runId: run.id } });
    return !!outbox?.deliveredAt;
  });
  const runId = enqueued.runs[0]?.id;
  if (!runId) throw new Error('EXPECTED_QUEUED_RUN');
  await worker.stop();
  // The new namespace has no copy of the first worker's Redis delivery.
  await db.runOutbox.update({
    where: { runId },
    data: { deliveredAt: new Date(Date.now() - 31000) },
  });
  worker = await startJobWorker(workerBackend.jobs, {
    prefix: `${workerPrefix}-restarted`,
  });
  const completed = await until(input, terminal);
  expect(completed.runs).toMatchObject([{ id: runId, status: 'succeeded' }]);
  expect(
    await db.run.findUnique({
      where: { id: runId },
      select: { attempts: true, documentIds: true },
    }),
  ).toEqual({ attempts: 1, documentIds: [source.id] });
  expect(await db.workUploadGroup.count({ where: input })).toBe(1);
}, 25000);

test('a failed file does not stop another file; retry reuses the successful extraction', async () => {
  const input = await create();
  const ocr = pauseStep();
  pauseOcr = ocr.wait;
  try {
    const first = await upload(input);
    await ocr.entered();
    await upload(input);
    failDocument = first.id;
    ocr.release();
    const state = await until(input, terminal);
    expect(state.runs[0]?.status).toBe('partial');
    expect(
      state.runs[0]?.steps.find(
        (step) => step.documentId === first.id && step.stage === 'extraction',
      ),
    ).toMatchObject({ status: 'failed', errorCode: 'LLM_INVALID_RESPONSE' });
    expect(state.facts.values.personName).toBe('Анна');
  } finally {
    ocr.release();
    pauseOcr = undefined;
    failDocument = undefined;
  }
  const before = extractionCount;
  await analyze(input);
  expect((await until(input, terminal)).runs[0]?.status).toBe('succeeded');
  expect(extractionCount - before).toBe(1);
});

test('deletion during model execution hides derivatives immediately and fences the late reply', async () => {
  const input = await create();
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
    const doc = await upload(input);
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
  const resource = `${input.workspaceId}:${input.workId}`;
  const first = await upload(input);
  const initial = await until(input, terminal);
  expect(extractionDocuments.get(resource)).toEqual([first.id]);
  await apiBackend.workHttp.review.confirmFacts(
    memberScope(input.workspaceId),
    {
      workId: brandWorkId(input.workId),
      revision: initial.work.revision,
    },
  );
  extractedName = 'Ирина';
  try {
    const second = await upload(input);
    const changed = await until(input, terminal);
    expect(changed.facts.values.personName).toBe('Анна');
    expect(changed.work.confirmedRevision).toBeNull();
    expect(extractionDocuments.get(resource)).toEqual([first.id, second.id]);
    await analyze(input);
    expect((await until(input, terminal)).facts.values.personName).toBe('Анна');
    expect(extractionDocuments.get(resource)).toEqual([first.id, second.id]);
  } finally {
    extractedName = 'Анна';
  }
});

test('new automatic groups retain prior facts and allow a DOCX with an open discrepancy', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId);
  const workId = brandWorkId(input.workId);
  const extracted: string[] = [];
  extractFixture = ({ document }) => {
    extracted.push(document.id);
    const value = extracted.length === 3 ? 'Ирина' : 'Анна';
    const evidence = (quote: string) => [
      { documentId: document.id, imagePath: null, quote },
    ];
    return Promise.resolve({
      candidates: [
        { field: 'personName', value, evidence: evidence(value) },
        ...(extracted.length === 2
          ? [
              {
                field: 'documentNumber' as const,
                value: '42',
                evidence: evidence('42'),
              },
            ]
          : []),
      ],
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  };
  try {
    const first = await upload(input);
    const initial = await until(input, terminal);
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: initial.work.revision,
      values: { ...initial.facts.values, observations: 'Ручная заметка' },
    });
    const second = await upload(input);
    const extended = await until(input, terminal);
    expect(extended.session?.id).toBe(initial.session?.id);
    expect(extended.facts.values.documentNumber).toBe('42');
    expect(
      extended.facts.candidates
        .filter(({ field }) => field === 'personName')
        .flatMap(({ evidence }) => evidence.map(({ documentId }) => documentId))
        .sort(),
    ).toEqual([first.id, second.id].sort());
    const third = await upload(input);
    const conflict = await until(input, terminal);
    expect(conflict.session?.id).toBe(initial.session?.id);
    expect(conflict.session?.revision).toBe(3);
    expect(extracted).toEqual([first.id, second.id, third.id]);
    expect(conflict.facts.values).toMatchObject({
      personName: 'Анна',
      documentNumber: '42',
      observations: 'Ручная заметка',
    });
    expect(conflict.discrepancyFields).toContain('personName');
    expect(conflict.availability.generate.available).toBe(true);
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: conflict.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const generated = (await until(input, terminal)).generations[0];
    const file = generated?.files[0];
    if (!generated || !file) throw new Error('MISSING_DOCUMENT_OUTPUT');
    const result = await apiBackend.workHttp.generation.downloadResult(scope, {
      workId,
      generationId: brandGenerationId(generated.id),
      fileId: brandFileId(file.id),
    });
    const xml = unzipSync(result.bytes)['word/document.xml'];
    if (!xml) throw new Error('MISSING_DOCUMENT_XML');
    const text = strFromU8(xml);
    expect(text).toContain('Анна');
    expect(text).not.toContain('Ирина');
  } finally {
    extractFixture = undefined;
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

function fixtureApp(workspaceId: string, userId = 'fixture') {
  const { workHttp, documentHttp } = apiBackend;
  const access = {
    ...workHttp.access,
    session: () =>
      Promise.resolve({
        user: {
          id: userId,
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
  return createApp({
    environment: 'test',
    logger,
    workHttp: { ...workHttp, access },
    documentHttp: { ...documentHttp, access },
  });
}

test.each(['work document', 'standalone recognition'])(
  'replaying an upload after deletion of the %s returns NOT_FOUND',
  async (kind) => {
    const { workspaceId, workId } = await create();
    const { workHttp } = apiBackend;
    const app = fixtureApp(workspaceId).listen({
      hostname: '127.0.0.1',
      port: 0,
    });
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

test('deleting a work with no source deletion requests reaches completion', async () => {
  const { workspaceId, workId } = await create();
  const scope = memberScope(workspaceId);
  const deletion = apiBackend.workHttp.deletion;
  expect(await deletion.request(scope, workId, crypto.randomUUID())).toEqual({
    status: 'deleting',
  });
  const deadline = Date.now() + 15000;
  while ((await deletion.status(scope, workId)).status !== 'deleted') {
    if (Date.now() > deadline) throw new Error('Work deletion did not finish');
    await Bun.sleep(30);
  }
  expect(
    await db.workDeletion.findFirst({
      where: { workspaceId, id: workId },
      select: { documentIds: true },
    }),
  ).toEqual({ documentIds: [] });
  expect(await db.work.findUnique({ where: { id: workId } })).toBeNull();
});

test('owner deletion fences a running writer, purges the work, and retains its source', async () => {
  const input = await create();
  const source = await upload(input);
  const scope = memberScope(input.workspaceId, 'fixture');
  const spare = await apiBackend.documentHttp.documents.commands.upload(scope, {
    filename: 'standalone.pdf',
    bytes: new TextEncoder().encode('%PDF-1.7\n standalone'),
    correlationId: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
  });
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
        workId: input.workId,
      },
    }),
  ).toBe(0);
  expect(
    await db.sourceDocument.count({
      where: { id: source.id, deletedAt: null },
    }),
  ).toBe(1);
  expect(
    await db.run.count({
      where: { documentId: source.id, status: 'succeeded' },
    }),
  ).toBe(1);
  expect(ownedThreads.some(({ id }) => threads.has(id))).toBe(false);
  expect(files.has(sourceKey)).toBe(true);
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

test('standalone images use cloud recognition once and work analysis reuses the saved text', async () => {
  const input = await create();
  const scope = memberScope(input.workspaceId, 'fixture');
  const before = describeCount;
  const image = {
    path: 'images/anyko-source-000.jpg',
    contentType: 'image/jpeg',
    bytes: fixtureImage,
  };
  const modes: unknown[] = [];
  parseFixture = (_bytes, _format, _attemptId, mode) => {
    modes.push(mode);
    return Promise.resolve({
      markdown: 'Локальный результат',
      processorVersion: 'fixture',
      images: [image],
    });
  };
  try {
    const document = await apiBackend.workHttp.intake.uploadDocument(scope, {
      workId: brandWorkId(input.workId),
      filename: 'scan.png',
      bytes: fixtureImage,
      correlationId: crypto.randomUUID(),
      requestKey: crypto.randomUUID(),
    });
    await until(input, (view) =>
      view.documents.some((doc) => doc.status === 'succeeded'),
    );
    const result = await apiBackend.documentHttp.documents.queries.result(
      scope,
      brandDocumentId(document.id),
    );
    expect(result.markdown).toBe('Заявитель: Анна\nКонтроль: 42');
    expect(modes).toEqual(['visual-inputs']);
    expect(describeCount - before).toBe(1);

    expect((await until(input, terminal)).runs[0]?.status).toBe('succeeded');
    expect(describeCount - before).toBe(1);
  } finally {
    parseFixture = undefined;
  }
});

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

test('Mastra sends the extraction text directly, keeps reconciliation tools, and erases messages on work deletion', async () => {
  const input = await create();
  const lastLine = 'ФИО заявителя: Анна';
  const signing = 'Подписано за день до регистрации от 22.08.2026';
  const debt = 'Два платежа: 100 рублей и 200 рублей';
  const reasoning = 'Синтетическое рассуждение перед извлечением.';
  const markdown = `${'Строка исходника.\n'.repeat(3000)}\n${lastLine}\n${signing}\n${debt}`;
  const encodedMarkdown = JSON.stringify(markdown).slice(1, -1);
  let documentId = '';
  let providerCalls = 0;
  let rateLimited = false;
  let sawImage = false,
    sawCompleteExtraction = false,
    extractionOfferedTools = false,
    sawReconciliationTool = false,
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
      if (
        request.method === 'GET' &&
        new URL(request.url).pathname === '/v1/models/fixture'
      )
        return Response.json({
          context_length: 32768,
          max_completion_tokens: 8192,
        });
      providerCalls++;
      const value: unknown = await request.json();
      const body = requestSchema.parse(value);
      const messages = JSON.stringify(body.messages);
      const coordinator = messages.includes('documents.analyzed');
      const visual = messages.includes('image_url');
      sawImage ||= visual;
      if (!coordinator && !visual) {
        if (!rateLimited) {
          rateLimited = true;
          return Response.json(
            { error: { message: 'Retry fixture' } },
            {
              status: 429,
              headers: { 'retry-after': '0' },
            },
          );
        }
        sawCompleteExtraction ||= body.messages.some(
          ({ role, content }) =>
            role === 'user' &&
            JSON.stringify(content).includes(encodedMarkdown),
        );
        extractionOfferedTools ||= Boolean(body.tools?.length);
        sawStructured ||= body.response_format !== undefined;
      }
      const toolResult = body.messages.some(
        (message) => message.role === 'tool',
      );
      const toolName =
        coordinator && !toolResult
          ? body.tools?.find(({ function: tool }) =>
              /read[-_]?field/i.test(tool.name),
            )?.function.name
          : undefined;
      sawReconciliationTool ||= coordinator && toolResult;
      const text = JSON.stringify(
        coordinator
          ? {
              summary: 'Сохранён контекст SDK',
              candidates: [
                {
                  origin: 'inference',
                  field: 'documentDate',
                  value: '2026-08-21',
                  explanation: 'Дата подписания на день раньше регистрации.',
                  evidence: [{ documentId, imagePath: null, quote: signing }],
                },
                {
                  origin: 'inference',
                  field: 'observations',
                  value: 'Совокупный платёж 300 рублей',
                  explanation: 'Сложены два платежа из документа.',
                  evidence: [{ documentId, imagePath: null, quote: debt }],
                },
              ],
            }
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
              function: {
                name: toolName,
                arguments: '{"field":"personName","offset":0}',
              },
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
                ...(!coordinator &&
                  !visual && { reasoning_content: reasoning }),
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
                  : {
                      content: text,
                      ...(!coordinator &&
                        !visual && { reasoning_content: reasoning }),
                    }),
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
    parseFixture = () =>
      Promise.resolve({
        markdown,
        images: imageFixture,
        processorVersion: 'fixture',
      });
    const doc = await upload(input);
    documentId = doc.id;
    const state = await until(input, terminal);
    expect(state.runs[0]?.status).toBe('succeeded');
    expect(state.facts.values.personName).toBe('Анна');
    expect(state.facts.values.documentDate).toBeNull();
    expect(state.facts.values.observations).toBeNull();
    const proposals = state.facts.candidates.filter(
      ({ origin }) => origin === 'inference',
    );
    expect(proposals).toMatchObject([
      {
        field: 'documentDate',
        value: '2026-08-21',
        selected: false,
        explanation: 'Дата подписания на день раньше регистрации.',
        evidence: [{ documentId, imagePath: null, quote: signing }],
      },
      {
        field: 'observations',
        value: 'Совокупный платёж 300 рублей',
        selected: false,
        explanation: 'Сложены два платежа из документа.',
        evidence: [{ documentId, imagePath: null, quote: debt }],
      },
    ]);
    const scope = memberScope(input.workspaceId);
    const workId = brandWorkId(input.workId);
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: state.work.revision,
      values: {
        ...state.facts.values,
        documentDate: '2026-08-21',
        observations: 'Совокупный платёж 300 рублей',
      },
    });
    const selected = await apiBackend.workHttp.views.get(scope, workId);
    await apiBackend.workHttp.review.confirmFacts(scope, {
      workId,
      revision: selected.work.revision,
    });
    const confirmed = await apiBackend.workHttp.views.get(scope, workId);
    expect(
      confirmed.facts.candidates.filter(({ origin }) => origin === 'inference'),
    ).toEqual(proposals.map((proposal) => ({ ...proposal, selected: true })));
    expect(sawImage).toBe(true);
    expect(sawCompleteExtraction).toBe(true);
    expect(extractionOfferedTools).toBe(false);
    expect(sawReconciliationTool).toBe(true);
    expect(sawStructured).toBe(true);
    const runId = state.runs[0]?.id;
    if (!runId) throw new Error('MISSING_ANALYSIS');
    expect(
      await apiBackend.workHttp.views.listAgentHistoryRuns(scope, workId, 1, 1),
    ).toMatchObject({
      items: [{ id: runId, status: 'succeeded' }],
      total: 1,
    });
    const history = await apiBackend.workHttp.views.agentHistory(
      scope,
      workId,
      runId,
      1,
      10,
    );
    expect(history.runUsage).toMatchObject({
      calls: providerCalls,
      inputTokens: (providerCalls - 1) * 10,
      outputTokens: (providerCalls - 1) * 5,
      unknownInputCalls: 1,
      unknownOutputCalls: 1,
    });
    expect(history.workUsage).toEqual(history.runUsage);
    expect(history.steps.map(({ stage }) => stage)).toEqual([
      'extraction',
      'reconciliation',
      'vision',
    ]);
    const extraction = history.items.find(
      ({ kind, stage, status }) =>
        kind === 'provider' && stage === 'extraction' && status === 'responded',
    );
    const failedExtraction = history.items.find(
      ({ kind, stage, status }) =>
        kind === 'provider' && stage === 'extraction' && status === 'failed',
    );
    expect(failedExtraction).toMatchObject({
      errorCode: 'HTTP_429',
      interactionId: extraction?.interactionId,
      inputTokens: null,
    });
    expect(extraction?.input).toContain(lastLine);
    expect(extraction?.output).toContain('personName');
    const tool = history.items.find(({ kind }) => kind === 'tool');
    expect(tool?.input).toContain('read-work-field');
    expect(tool?.input).toContain('personName');
    expect(tool?.output).toContain('Анна');
    const decision = history.items.find(
      ({ kind, status, stage }) =>
        kind === 'decision' &&
        status === 'accepted' &&
        stage === 'reconciliation',
    );
    expect(decision?.output).toContain('Сохранён контекст SDK');
    expect(decision?.output).toContain('"proposalOutcomes"');
    expect(decision?.output).toContain(
      '"stage":"extraction","candidate":{"field":"personName"',
    );
    expect(decision?.output).toContain('"status":"applied"');
    expect(decision?.output).toContain('"status":"review"');
    await rejects(
      apiBackend.workHttp.views.agentHistory(
        memberScope(crypto.randomUUID()),
        workId,
        runId,
        1,
        10,
      ),
      'NOT_FOUND',
    );
    const vision = await db.runStep.findFirstOrThrow({
      where: { run: { workId: input.workId }, stage: 'vision' },
    });
    expect(vision.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    threadIds = await workProcessing.threads(input.workspaceId, input.workId);
    const memory = await inspection.getStore('memory');
    if (!memory || !threadIds[0]) throw new Error('MISSING_MEMORY_FIXTURE');
    const stored = await Promise.all(
      threadIds.map(
        async (threadId) => (await memory.listMessages({ threadId })).messages,
      ),
    );
    expect(JSON.stringify(stored)).toContain(reasoning);
    const deletion = apiBackend.workHttp.deletion;
    await deletion.request(scope, workId, crypto.randomUUID());
    const deadline = Date.now() + 15000;
    while ((await deletion.status(scope, workId)).status !== 'deleted') {
      if (Date.now() > deadline)
        throw new Error('Work deletion did not finish');
      await Bun.sleep(30);
    }
    expect(await db.work.findUnique({ where: { id: workId } })).toBeNull();
    expect(await db.workAgentEvent.count({ where: { workId } })).toBe(0);
    for (const threadId of threadIds) {
      expect(await memory.getThreadById({ threadId })).toBeNull();
      expect((await memory.listMessages({ threadId })).messages).toEqual([]);
    }
  } finally {
    for (const id of threadIds) await actualAgents.eraseThread(id);
    await actualAgents.stop();
    actualAgents = undefined;
    imageFixture = [];
    parseFixture = undefined;
    await inspection.close();
    await server.stop(true);
  }
});

test('rerunning analysis refreshes old visual descriptions and reuses the refreshed result', async () => {
  const input = await create();
  const resource = `${input.workspaceId}:${input.workId}`;
  imageFixture = [
    {
      path: 'images/picture.png',
      contentType: 'image/png',
      bytes: fixtureImage,
    },
  ];
  try {
    const source = await upload(input);
    const first = await until(input, terminal);
    const run = first.runs[0];
    expect(run?.status).toBe('succeeded');
    if (!run) throw new Error('MISSING_ANALYSIS');
    // Older runs used the OCR digest alone as the cache key.
    expect(
      await db.$executeRaw`
        UPDATE "RunStep"
        SET output = jsonb_set(output, '{sourceDigest}', to_jsonb(split_part(output->>'sourceDigest', ':', 2)))
        WHERE "runId" = ${run.id} AND stage IN ('vision', 'extraction')
          AND output->>'sourceDigest' LIKE 'vision-%:%'
      `,
    ).toBe(2);
    expect(descriptionsByResource.get(resource)).toBe(1);
    expect(extractionDocuments.get(resource)).toEqual([source.id]);

    await analyze(input);
    const refreshed = await until(
      input,
      (view) => terminal(view) && view.runs[0]?.id !== run.id,
    );
    expect(refreshed.runs[0]?.status).toBe('succeeded');
    expect(descriptionsByResource.get(resource)).toBe(2);
    expect(extractionDocuments.get(resource)).toEqual([source.id, source.id]);

    await analyze(input);
    const cached = await until(
      input,
      (view) => terminal(view) && view.runs[0]?.id !== refreshed.runs[0]?.id,
    );
    expect(cached.runs[0]?.status).toBe('succeeded');
    expect(descriptionsByResource.get(resource)).toBe(2);
    expect(extractionDocuments.get(resource)).toEqual([source.id, source.id]);
  } finally {
    imageFixture = [];
  }
});

test('logical session survives reopening, extends context with a new source, and keeps extraction cached', async () => {
  const input = await create();
  const first = await upload(input);
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
  const before = await until(input, terminal);
  reconcileHook = () => Promise.reject(new LlmError('LLM_UNAVAILABLE'));
  try {
    await upload(input);
    const next = await until(input, terminal);
    expect(next.runs[0]?.status).toBe('partial');
    expect(next.facts.values.personName).toBe('Анна');
    expect(next.session?.revision).toBe(before.session?.revision);
    expect(next.session?.context?.workRevision).not.toBe(next.work.revision);
  } finally {
    reconcileHook = undefined;
  }
});

test('invalid reconciliation preserves direct passport facts and a rerun keeps lawyer choices and citations', async () => {
  const input = await create('bfl-bankruptcy-v8');
  const scope = memberScope(input.workspaceId);
  const workId = brandWorkId(input.workId);
  const heading = 'Паспорт гражданина Российской Федерации';
  const surname = 'Фамилия ИВАНОВ';
  const birthplace = 'Место рождения ГОР. КИРОВ';
  const recentCalls: number[] = [];
  parseFixture = (bytes) => {
    const marker = new TextDecoder().decode(bytes);
    return Promise.resolve({
      markdown: marker.includes('passport-preserved')
        ? [heading, surname, birthplace].join('\n')
        : 'Сопроводительное письмо',
      processorVersion: 'fixture',
    });
  };
  extractFixture = ({ document }) =>
    Promise.resolve({
      candidates: document.text.includes(heading)
        ? [
            {
              field: 'lastName',
              value: 'ИВАНОВ',
              evidence: [
                { documentId: document.id, imagePath: null, quote: surname },
              ],
            },
            {
              field: 'birthPlace',
              value: 'ГОР. КИРОВ',
              evidence: [
                { documentId: document.id, imagePath: null, quote: birthplace },
              ],
            },
          ]
        : [],
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  reconcileHook = ({ documents }) => {
    recentCalls.push(documents.length);
    return Promise.reject(new LlmError('LLM_INVALID_RESPONSE'));
  };
  try {
    const passport = await upload(input, 'passport-preserved');
    await upload(input, 'letter-preserved');
    const first = await until(
      input,
      (view) => terminal(view) && view.documents.length === 2,
    );
    expect(first.runs[0]?.status).toBe('partial');
    expect(
      first.runs[0]?.steps.find(({ stage }) => stage === 'reconciliation'),
    ).toMatchObject({
      status: 'failed',
      errorCode: 'LLM_INVALID_RESPONSE',
    });
    expect(first.facts.values).toMatchObject({
      lastName: 'ИВАНОВ',
      birthPlace: 'ГОР. КИРОВ',
      citizenship: 'Российская Федерация',
    });
    for (const [field, quote] of [
      ['lastName', surname],
      ['birthPlace', birthplace],
      ['citizenship', heading],
    ] as const) {
      const candidate = first.facts.candidates.find(
        (item) =>
          item.field === field &&
          item.evidence.some((source) => source.quote === quote),
      );
      expect(candidate?.selected).toBe(true);
      expect(candidate?.evidence).toEqual([
        { documentId: passport.id, imagePath: null, quote },
      ]);
    }
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: first.work.revision,
      values: { ...first.facts.values, lastName: 'Исправлено юристом' },
    });
    await analyze(input);
    const second = await until(
      input,
      (view) => terminal(view) && view.runs[0]?.id !== first.runs[0]?.id,
    );
    expect(recentCalls).toContain(2);
    expect(second.runs[0]?.status).toBe('partial');
    expect(second.facts.values.lastName).toBe('Исправлено юристом');
    expect(second.facts.values.birthPlace).toBe('ГОР. КИРОВ');
    expect(
      second.facts.candidates.filter(({ field }) => field === 'citizenship'),
    ).toHaveLength(1);
    expect(
      second.facts.candidates.filter(({ field }) => field === 'birthPlace'),
    ).toHaveLength(1);
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
    reconcileHook = undefined;
  }
});

test('statement and creditor list keep a newer documented balance after reconciliation fails', async () => {
  const input = await create('bfl-bankruptcy-v12');
  const scope = memberScope(input.workspaceId);
  const workId = brandWorkId(input.workId);
  const parsing = pauseStep();
  const certificates = [
    {
      contractNumber: 'QA-VT-51',
      amount: '151000.00',
      amountDate: '28.10.2026',
      name: 'Банк ВТБ (ПАО)',
    },
    {
      contractNumber: 'QA-VT-51',
      amount: '145006.47',
      amountDate: '18.11.2026',
      name: 'Банк ВТБ (ПАО)',
    },
    {
      contractNumber: 'QA-VT-52',
      amount: '11500.25',
      amountDate: '18.11.2026',
      name: 'Банк ВТБ (ПАО)',
    },
    {
      contractNumber: 'QA-T-62',
      amount: '15993.53',
      amountDate: '20.11.2026',
      name: 'АО «ТБанк»',
    },
  ];
  const text = ({
    name,
    contractNumber,
    amount,
    amountDate,
  }: (typeof certificates)[number]) =>
    [
      name,
      `Кредитный договор № ${contractNumber} от 03.01.2025`,
      `По состоянию на ${amountDate}`,
      `Полная задолженность ${amount.replace('.', ',')} руб.`,
    ].join('\n');
  parseFixture = async (bytes) => {
    await parsing.wait();
    return {
      markdown: new TextDecoder().decode(bytes).slice('%PDF-1.7\n '.length),
      processorVersion: 'fixture',
    };
  };
  extractFixture = ({ document }) =>
    Promise.resolve({
      candidates: certificates
        .filter((row) => text(row) === document.text.trim())
        .map((row) => ({
          field: 'debts',
          value: [
            {
              ...row,
              contractDate: '03.01.2025',
              debtStatus: 'Действует',
              type: 'Кредит',
            },
          ],
          evidence: [
            { documentId: document.id, imagePath: null, quote: text(row) },
          ],
        })),
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  reconcileHook = () => Promise.reject(new LlmError('LLM_INVALID_RESPONSE'));
  try {
    for (const row of certificates) await upload(input, text(row));
    parsing.release();
    const draft = await until(
      input,
      (view) => terminal(view) && view.documents.length === certificates.length,
    );
    expect(draft.runs[0]?.status).toBe('partial');
    expect(draft.facts.values.debts).toHaveLength(3);
    expect(
      draft.facts.candidates.filter(({ field }) => field === 'debts'),
    ).toHaveLength(4);
    await apiBackend.workHttp.review.confirmFacts(scope, {
      workId,
      revision: draft.work.revision,
    });
    const confirmed = await until(
      input,
      (view) => view.work.confirmedRevision === view.work.revision,
    );
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: confirmed.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const output = await until(input, (view) =>
      view.generations.some(({ status }) => status === 'succeeded'),
    );
    const generation = output.generations.find(
      ({ status }) => status === 'succeeded',
    );
    if (!generation) throw new Error('DEBT_GENERATION_MISSING');
    for (const version of ['bfl-statement-v11', 'bfl-creditors-v3']) {
      const file = generation.files.find(
        ({ templateVersion }) => templateVersion === version,
      );
      if (!file) throw new Error('DEBT_DOCUMENT_MISSING');
      const { bytes } = await apiBackend.workHttp.generation.downloadResult(
        scope,
        {
          workId,
          generationId: brandGenerationId(generation.id),
          fileId: brandFileId(file.id),
        },
      );
      const xml = strFromU8(
        unzipSync(bytes)['word/document.xml'] ?? new Uint8Array(),
      );
      expect(xml.replace(/\s/gu, ' ')).toContain('172 500,25');
      expect(xml).toContain('QA-VT-51');
      expect(xml).not.toContain('151 000');
    }
  } finally {
    parsing.release();
    parseFixture = undefined;
    extractFixture = undefined;
    reconcileHook = undefined;
  }
});

test('manual edit during contextual reasoning retries from fresh facts and fences the stale summary', async () => {
  const input = await create();
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
    await upload(input);
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
    const doc = await upload(input);
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

type Command = Exclude<
  keyof WorkView['availability'],
  'attach' | 'updateRecognition'
>;
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
    if (state === 'ready') await until({ workspaceId, workId }, terminal);
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

test('bank certificates retain evidence and a manual contract decision, and both downloaded DOCX agree', async () => {
  const { workspaceId } = await create();
  const scope = memberScope(workspaceId, 'fixture');
  const workId = await apiBackend.workHttp.intake.createWork(scope, {
    packageVersion: 'bfl-bankruptcy-v7',
    title: 'Синтетические банковские справки',
  });
  const input = { workspaceId, workId };
  const certificates = {
    primary: {
      number: 'BANK-01',
      date: '08.11.2026',
      total: '1234,05',
      status: 'Действует',
      text: 'Полная задолженность 1234,05 руб. Неустойка 8,15 руб.',
    },
    copy: {
      number: 'BANK-01',
      date: '09.11.2026',
      total: '1234,05',
      status: 'Действует',
      text: 'Общая задолженность 1234,05 руб.',
    },
    other: {
      number: 'BANK-02',
      date: '08.11.2026',
      total: '200,06',
      status: 'Действует',
      text: 'Полная задолженность 200,06 руб.',
    },
    paid: {
      number: 'BANK-03',
      date: '08.11.2026',
      total: null,
      status: 'Погашен',
      text: 'Кредит полностью погашен.',
    },
    turnover: {
      number: 'BANK-04',
      date: '08.11.2026',
      total: '7000,10',
      status: 'Действует',
      text: 'Обороты по банковскому счёту: 7000,10 руб.',
    },
    changed: {
      number: 'BANK-01',
      date: '10.11.2026',
      total: '2222,10',
      status: 'Действует',
      text: 'Общая задолженность 2222,10 руб.',
    },
    closed: {
      number: 'BANK-02',
      date: '10.11.2026',
      total: null,
      status: 'Закрыт',
      text: 'Кредитный договор закрыт.',
    },
  };
  const name = 'АО Синтетический Банк';
  const sourceText = ({
    number,
    date,
    text,
  }: (typeof certificates)[keyof typeof certificates]) =>
    [
      name,
      'Договор № ' + number + ' от 03.01.2025',
      'По состоянию на ' + date,
      text,
    ].join('\n');
  parseFixture = (bytes) => {
    const marker = new TextDecoder().decode(bytes).split('\n').at(-1)?.trim();
    const certificate = Object.entries(certificates).find(
      ([key]) => key === marker,
    )?.[1];
    if (!certificate) throw new Error('UNKNOWN_BANK_FIXTURE');
    return Promise.resolve({
      markdown: sourceText(certificate),
      processorVersion: 'fixture',
    });
  };
  extractFixture = ({ document, fields }) => {
    const certificate = Object.values(certificates).find((entry) =>
      document.text.includes(sourceText(entry)),
    );
    if (
      !certificate ||
      !fields
        ?.find(({ key }) => key === 'debts')
        ?.columns.some(({ key }) => key === 'amountDate')
    )
      throw new Error('EXPECTED_BANK_FIELDS');
    return Promise.resolve({
      candidates: [
        {
          field: 'debts',
          value: [
            {
              name,
              contractNumber: certificate.number,
              contractDate: '03.01.2025',
              amountDate: certificate.date,
              debtStatus: certificate.status,
              amount: certificate.total,
              ...(certificate === certificates.primary && {
                penalties: '8.15',
              }),
            },
          ],
          evidence: [
            {
              documentId: document.id,
              imagePath: null,
              quote: sourceText(certificate),
            },
          ],
        },
      ],
      usage: { inputTokens: 4, outputTokens: 4 },
    });
  };

  const addCertificate = async (key: keyof typeof certificates) => {
    const source = await upload(input, key);
    await until(
      input,
      (view) =>
        terminal(view) &&
        view.documents.some(
          (doc) => doc.id === source.id && doc.status === 'succeeded',
        ),
    );
    return source;
  };

  try {
    const primary = await addCertificate('primary');
    const copy = await addCertificate('copy');
    await addCertificate('other');
    await addCertificate('paid');
    await addCertificate('turnover');
    const original = await until(input, terminal);
    const debts = original.facts.values.debts;
    if (!Array.isArray(debts)) throw new Error('BANK_FACTS_MISSING');
    expect(debts).toHaveLength(3);
    const primaryDebt = debts.find(
      ({ contractNumber }) => contractNumber === 'BANK-01',
    );
    expect(primaryDebt).toMatchObject({
      amount: '1234.05',
      amountDate: '08.11.2026',
      penalties: '8.15',
    });
    expect(
      debts.find(({ contractNumber }) => contractNumber === 'BANK-02')?.amount,
    ).toBe('200.06');
    expect(
      debts.find(({ contractNumber }) => contractNumber === 'BANK-03')
        ?.debtStatus,
    ).toBe('Погашен');
    const selectedSources = original.facts.candidates
      .filter(({ selected, field }) => selected && field === 'debts')
      .flatMap(({ evidence }) => evidence.map(({ documentId }) => documentId));
    expect(selectedSources).toContain(primary.id);
    expect(selectedSources).toContain(copy.id);

    const manual = debts.map((row) =>
      row.contractNumber === 'BANK-01' ? { ...row, amount: '1234.15' } : row,
    );
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: original.work.revision,
      values: { ...original.facts.values, debts: manual, lastName: 'Тестовый' },
    });
    const changed = await addCertificate('changed');
    const closed = await addCertificate('closed');
    const reviewed = await until(input, terminal);
    expect(reviewed.facts.values.debts).toEqual(manual);
    expect(reviewed.discrepancyFields).toContain('debts');
    const alternatives = reviewed.facts.candidates
      .filter(({ selected }) => !selected)
      .flatMap(({ evidence }) => evidence.map(({ documentId }) => documentId));
    expect(alternatives).toContain(changed.id);
    expect(alternatives).toContain(closed.id);

    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: reviewed.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const generated = await until(input, (view) =>
      view.generations.some(({ status }) => status === 'succeeded'),
    );
    const generation = generated.generations[0];
    if (!generation) throw new Error('GENERATION_MISSING');

    const files = generation.files.filter(({ templateVersion }) =>
      ['bfl-statement-v7', 'bfl-creditors-v2'].includes(templateVersion),
    );
    expect(files).toHaveLength(2);
    for (const { id, templateVersion } of files) {
      const result = await apiBackend.workHttp.generation.downloadResult(
        scope,
        {
          workId,
          generationId: brandGenerationId(generation.id),
          fileId: brandFileId(id),
        },
      );
      const xml = strFromU8(
        unzipSync(result.bytes)['word/document.xml'] ?? new Uint8Array(),
      );
      expect(xml).toContain('1434,21');
      expect(xml).toContain('1234,15');
      expect(xml).toContain('200,06');
      expect(xml.match(/BANK-01/g)).toHaveLength(1);
      expect(xml).not.toMatch(/BANK-03|BANK-04|7000,10|2222,10|8,15/);
      if (templateVersion === 'bfl-statement-v7') {
        const header = xml.slice(0, xml.indexOf('</w:tbl>'));
        expect(header.match(/Синтетический Банк/g)).toHaveLength(1);
      }
    }
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
}, 60000);

test('employment records and income certificates reach review and the downloaded statement', async () => {
  const { workspaceId } = await create();
  const scope = memberScope(workspaceId, 'fixture');
  const workId = await apiBackend.workHttp.intake.createWork(scope, {
    packageVersion: 'bfl-bankruptcy-v7',
    title: 'Синтетическая трудовая и справки о доходах',
  });
  const input = { workspaceId, workId };
  const north = 'ООО Север';
  const south = 'ООО Юг';
  const history = [
    {
      employer: north,
      date: '05.04.2025',
      event: 'Приём',
      quote: '05.04.2025 Принят на работу в ООО Север',
    },
    {
      employer: north,
      date: '10.02.2026',
      event: 'Увольнение',
      quote: '10.02.2026 Уволен из ООО Север',
    },
    {
      employer: south,
      date: '23.02.2026',
      event: 'Приём',
      quote: '23.02.2026 Принят на работу в ООО Юг',
    },
  ];
  const termination = {
    employer: south,
    date: '13.03.2026',
    event: 'Увольнение',
    quote: '13.03.2026 Уволен из ООО Юг',
  };
  const northIncome = [
    {
      month: '2026-01',
      code: '2000',
      amount: '90000.01',
      quote: '| 01 | 2000 | 90000,01 |',
    },
    {
      month: '2026-02',
      code: '2000',
      amount: '30000.00',
      quote: '| 02 | 2000 | 30000,00 |',
    },
  ];
  const southIncome = [
    {
      month: '2026-02',
      code: '2000',
      amount: '10000.00',
      quote: '| 02 | 2000 | 10000,00 |',
    },
    {
      month: '2026-03',
      code: '2000',
      amount: '70000.00',
      quote: '| 03 | 2000 | 70000,00 |',
    },
    {
      month: '2026-03',
      code: '2002',
      amount: '10000.00',
      quote: '| 03 | 2002 | 10000,00 |',
    },
  ];
  const invalidIncome = {
    month: '2026-02',
    code: '2002',
    amount: '70000.00',
    quote: '| 03 | 2000 | 70000,00 |',
  };
  const taxYear = 'Справка о доходах за 2026 год';
  const documents = {
    'employment-book': history.map(({ quote }) => quote).join('\n'),
    'employment-north': [
      taxYear,
      north,
      ...northIncome.map(({ quote }) => quote),
    ].join('\n'),
    'employment-south': [
      taxYear,
      south,
      ...southIncome.map(({ quote }) => quote),
    ].join('\n'),
    'employment-termination': termination.quote,
  };
  parseFixture = (bytes) => {
    const key = new TextDecoder().decode(bytes).split('\n').at(-1)?.trim();
    const markdown = Object.entries(documents).find(([id]) => id === key)?.[1];
    if (!markdown) throw new Error('UNKNOWN_EMPLOYMENT_SOURCE');
    return Promise.resolve({ markdown, processorVersion: 'fixture' });
  };
  extractFixture = ({ document, fields }) => {
    expect(fields?.some(({ key }) => key === 'employmentHistory')).toBe(true);
    expect(fields?.some(({ key }) => key === 'employmentIncome')).toBe(true);
    const evidence = (quote: string) => ({
      documentId: document.id,
      imagePath: null,
      quote,
    });
    const employmentCandidates = (records: typeof history) =>
      records.map(({ quote, ...row }) => ({
        field: 'employmentHistory' as const,
        value: [row],
        evidence: [evidence(quote)],
      }));
    const incomeCandidates = (employer: string, records: typeof northIncome) =>
      records.map(({ quote, ...row }) => ({
        field: 'employmentIncome' as const,
        value: [{ employer, ...row }],
        evidence: [evidence(taxYear), evidence(employer), evidence(quote)],
      }));
    const candidates = document.text.includes(documents['employment-book'])
      ? employmentCandidates(history)
      : document.text.includes(termination.quote)
        ? employmentCandidates([termination])
        : document.text.includes(north)
          ? incomeCandidates(north, northIncome)
          : incomeCandidates(south, [...southIncome, invalidIncome]);
    return Promise.resolve({
      candidates,
      usage: { inputTokens: 4, outputTokens: 4 },
    });
  };

  const addSource = async (key: keyof typeof documents) => {
    const source = await upload(input, key);
    await until(
      input,
      (view) =>
        terminal(view) &&
        view.documents.some(
          ({ id, status }) => id === source.id && status === 'succeeded',
        ),
    );
    return source;
  };
  const renderStatement = async (view: WorkView) => {
    const previous = new Set(view.generations.map(({ id }) => id));
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: view.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const generated = await until(input, (state) =>
      state.generations.some(
        ({ id, status }) => !previous.has(id) && status === 'succeeded',
      ),
    );
    const generation = generated.generations.find(
      ({ id }) => !previous.has(id),
    );
    const statement = generation?.files.find(
      ({ filename }) => filename === 'statement.docx',
    );
    if (!generation || !statement)
      throw new Error('EMPLOYMENT_STATEMENT_MISSING');
    const result = await apiBackend.workHttp.generation.downloadResult(scope, {
      workId,
      generationId: brandGenerationId(generation.id),
      fileId: brandFileId(statement.id),
    });
    return strFromU8(
      unzipSync(result.bytes)['word/document.xml'] ?? new Uint8Array(),
    );
  };

  try {
    const book = await addSource('employment-book');
    const prior = await addSource('employment-north');
    const current = await addSource('employment-south');
    const reviewed = await until(input, terminal);
    expect(reviewed.facts.values.employmentHistory).toHaveLength(3);
    expect(reviewed.facts.values.employmentIncome).toHaveLength(5);
    const selectedSources = new Set(
      reviewed.facts.candidates
        .filter(({ selected }) => selected)
        .flatMap(({ evidence }) =>
          evidence.map(({ documentId }) => documentId),
        ),
    );
    expect(selectedSources).toEqual(new Set([book.id, prior.id, current.id]));
    const rejected = reviewed.facts.candidates.find(
      ({ field, value }) =>
        field === 'employmentIncome' &&
        Array.isArray(value) &&
        value.some(
          ({ employer, month, amount }) =>
            employer === south && month === '2026-02' && amount === '70000.00',
        ),
    );
    expect(rejected?.selected).toBe(false);
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: reviewed.work.revision,
      values: { ...reviewed.facts.values, documentDate: '14.03.2026' },
    });
    const active = await renderStatement(await until(input, terminal));
    expect(active).toContain('В настоящее время работаю в ООО Юг.');
    expect(active).toContain('60900,00 руб.');
    expect(active).not.toContain('ООО Север');

    await addSource('employment-termination');
    const terminated = await renderStatement(await until(input, terminal));
    expect(terminated).toContain('не осуществляю трудовую деятельность');
    expect(terminated).not.toMatch(/ООО Юг|Средняя заработная плата|60900,00/);
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
});

test('each EGRN cadastral number follows its property into the facts and the inventory', async () => {
  const input = await create('bfl-bankruptcy-v13');
  const scope = memberScope(input.workspaceId);
  const workId = brandWorkId(input.workId);
  const properties = [
    {
      row: {
        description: 'Квартира',
        address: 'г. Тестовый, ул. Новая, д. 1, кв. 2',
      },
      number: '48:08:0000000:9000001',
    },
    {
      row: {
        description: 'Гараж',
        address: 'г. Тестовый, ул. Садовая, д. 5',
      },
      number: '48:08:0000000:9000002',
    },
  ];
  const unnumbered = {
    description: 'Жилой дом',
    address: 'г. Тестовый, ул. Центральная, д. 8',
  };
  const unsupported = '48:08:0000000:9000003';
  parseFixture = () =>
    Promise.resolve({
      markdown: [
        'Выписка из Единого государственного реестра недвижимости',
        ...properties.flatMap(({ row, number }) => [
          `Вид объекта недвижимости: ${row.description}.`,
          `Кадастровый номер: ${number}.`,
          `Адрес: ${row.address}.`,
        ]),
        `Вид объекта недвижимости: ${unnumbered.description}.`,
        `Адрес: ${unnumbered.address}.`,
      ].join('\n'),
      processorVersion: 'fixture',
    });
  extractFixture = ({ document }) =>
    Promise.resolve({
      candidates: [
        ...properties.map(({ row }) => row),
        { ...unnumbered, identifier: unsupported },
      ].map((row) => ({
        field: 'realEstate',
        value: [row],
        evidence: [
          {
            documentId: document.id,
            imagePath: null,
            quote: `Адрес: ${row.address}.`,
          },
        ],
      })),
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  try {
    const source = await upload(input, 'egrn-number-fixture');
    const initial = await until(input, terminal);
    expect(initial.facts.values.realEstate).toEqual([
      ...properties.map(({ row, number }) => ({ ...row, identifier: number })),
      unnumbered,
    ]);
    for (const { number } of properties) {
      const evidence = initial.facts.candidates
        .filter(({ field, selected }) => field === 'realEstate' && selected)
        .flatMap(({ evidence }) => evidence);
      expect(evidence).toContainEqual({
        documentId: source.id,
        imagePath: null,
        quote: `Кадастровый номер: ${number}`,
      });
    }

    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: initial.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const result = await until(input, (view) =>
      view.generations.some(({ status }) => status === 'succeeded'),
    );
    const generation = result.generations.find(
      ({ status }) => status === 'succeeded',
    );
    const inventory = generation?.files.find(
      ({ templateVersion }) => templateVersion === 'bfl-inventory-v2',
    );
    if (!generation || !inventory) throw new Error('INVENTORY_MISSING');
    const { bytes } = await apiBackend.workHttp.generation.downloadResult(
      scope,
      {
        workId,
        generationId: brandGenerationId(generation.id),
        fileId: brandFileId(inventory.id),
      },
    );
    const xml = strFromU8(
      unzipSync(bytes)['word/document.xml'] ?? new Uint8Array(),
    );
    for (const { row, number } of properties)
      expect(xml).toContain(`${row.description}, кадастровый номер ${number}`);
    expect(xml).not.toContain(unsupported);
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
}, 60000);

test('an EGRN source fills inventory and only confirmed supported files enter the statement', async () => {
  const { workspaceId } = await create();
  const scope = memberScope(workspaceId, 'fixture');
  const packageVersion = 'bfl-bankruptcy-v8';
  const workId = await apiBackend.workHttp.intake.createWork(scope, {
    packageVersion,
    title: 'Синтетические приложения к заявлению',
  });
  const input = { workspaceId, workId };
  const egrn = 'Выписка из ЕГРН · выписка подписана ЭП';
  const realEstate = {
    description: 'Гараж',
    address: 'ул. Синтетическая, 101',
    area: '21.5',
  };
  const property = Object.values(realEstate).join(' ');
  const expenses = 'Чек об оплате расходов по процедуре';
  const remuneration = 'Документ о внесении вознаграждения';
  const scans = 'Справка с изображением печати';
  const misc = 'Материал для сверки';
  const texts = {
    'egrn-fixture': [egrn, property].join('\n'),
    'expense-fixture': expenses,
    'remuneration-fixture': remuneration,
    'stamp-fixture': scans,
    'internal-fixture': misc,
  };
  parseFixture = (bytes) => {
    const key = new TextDecoder().decode(bytes).split('\n').at(-1)?.trim();
    const markdown = Object.entries(texts).find(([id]) => id === key)?.[1];
    if (!markdown) throw new Error('UNKNOWN_ATTACHMENT_SOURCE');
    return Promise.resolve({ markdown, processorVersion: 'fixture' });
  };
  extractFixture = ({ document }) => {
    const evidence = (quote: string) => [
      { documentId: document.id, imagePath: null, quote },
    ];
    const title = document.text.split('\n')[0] ?? '';
    const candidates: Awaited<
      ReturnType<DocumentAgents['extract']>
    >['candidates'] = [
      {
        field: 'attachments',
        value: [
          {
            description: title,
            category:
              title === egrn
                ? 'egrn'
                : title === expenses
                  ? 'procedureExpenses'
                  : title === remuneration
                    ? 'trusteeRemuneration'
                    : 'other',
          },
        ],
        evidence: evidence(title),
      },
    ];
    if (title === egrn)
      candidates.push(
        {
          field: 'realEstate',
          value: [realEstate],
          evidence: evidence(property),
        },
        {
          field: 'propertyDetails',
          value: property,
          evidence: evidence(property),
        },
      );
    return Promise.resolve({
      candidates,
      usage: { inputTokens: 4, outputTokens: 4 },
    });
  };
  try {
    const added = [];
    for (const name of Object.keys(texts)) {
      const source = await upload(input, name);
      await until(
        input,
        (view) =>
          terminal(view) &&
          view.documents.some(
            ({ id, status }) => id === source.id && status === 'succeeded',
          ),
      );
      added.push(source.id);
    }
    const [extract, expense, , stamp] = added;
    const initial = await until(input, terminal);
    expect(initial.facts.values.realEstate).toEqual([realEstate]);
    expect(initial.facts.values.propertyDetails).toBeNull();
    expect(initial.facts.values.submittedAttachments).toBeNull();
    const sourceFacts = initial.facts.candidates.filter(({ evidence }) =>
      evidence.some(({ documentId }) => documentId === extract),
    );
    expect(
      sourceFacts
        .filter(({ field }) => field === 'attachments')
        .map(({ value }) => value),
    ).toContainEqual([
      {
        description: 'Выписка из Единого государственного реестра недвижимости',
        category: 'egrn',
      },
    ]);
    expect(
      sourceFacts.find(({ field }) => field === 'realEstate')?.value,
    ).toEqual([realEstate]);
    const rejected = {
      documentId: crypto.randomUUID(),
      description: misc,
      copyKind: 'copy',
      category: 'other',
    };
    await rejects(
      apiBackend.workHttp.review.editValues(scope, {
        workId,
        revision: initial.work.revision,
        values: { ...initial.facts.values, submittedAttachments: [rejected] },
      }),
      'NOT_FOUND',
    );
    const selected = [
      {
        documentId: extract ?? '',
        description: 'Выписка из ЕГРН',
        copyKind: 'electronicOriginal',
        category: 'egrn',
      },
      {
        documentId: expense ?? '',
        description: 'Чек № 101',
        copyKind: 'paperOriginal',
        category: 'procedureExpenses',
      },
      {
        documentId: stamp ?? '',
        description: scans,
        copyKind: 'copy',
        category: 'other',
      },
      {
        documentId: 'package:inventory',
        description:
          'Опись имущества гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
        copyKind: 'paperOriginal',
        category: 'other',
      },
    ];
    const generated = selected.at(-1);
    if (!generated) throw new Error('INVENTORY_ATTACHMENT_MISSING');
    await rejects(
      apiBackend.workHttp.review.editValues(scope, {
        workId,
        revision: initial.work.revision,
        values: {
          ...initial.facts.values,
          submittedAttachments: [{ ...generated, copyKind: 'copy' }],
        },
      }),
      'INVALID_WORK_INPUT',
    );
    await apiBackend.workHttp.review.editValues(scope, {
      workId,
      revision: initial.work.revision,
      values: { ...initial.facts.values, submittedAttachments: selected },
    });
    const edited = await until(input, terminal);
    expect(edited.facts.values.submittedAttachments).toEqual(selected);
    await apiBackend.workHttp.generation.startGeneration(scope, {
      workId,
      revision: edited.work.revision,
      correlationId: crypto.randomUUID(),
    });
    const output = await until(input, (view) =>
      view.generations.some(({ status }) => status === 'succeeded'),
    );
    const generation = output.generations.find(
      ({ status }) => status === 'succeeded',
    );
    if (!generation) throw new Error('ATTACHMENT_GENERATION_MISSING');
    const readDocument = async (filename: string) => {
      const file = generation.files.find((row) => row.filename === filename);
      if (!file) throw new Error('ATTACHMENT_DOCUMENT_MISSING');
      const result = await apiBackend.workHttp.generation.downloadResult(
        scope,
        {
          workId,
          generationId: brandGenerationId(generation.id),
          fileId: brandFileId(file.id),
        },
      );
      return strFromU8(
        unzipSync(result.bytes)['word/document.xml'] ?? new Uint8Array(),
      );
    };
    const statement = await readDocument('statement.docx');
    const inventory = await readDocument('inventory.docx');
    expect(inventory).toContain('ул. Синтетическая, 101');
    expect(statement).not.toContain('ул. Синтетическая, 101');
    expect(statement).toContain('Выписка из ЕГРН (оригинал)');
    expect(statement).toContain('Чек № 101 — расходы по процедуре (оригинал)');
    expect(statement).toContain('Справка с изображением печати (копия)');
    expect(statement).toContain('№ 530 (оригинал)');
    expect(statement).not.toContain(remuneration);
    expect(statement).not.toContain(misc);
  } finally {
    parseFixture = undefined;
    extractFixture = undefined;
  }
}, 60000);
