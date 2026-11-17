import { type BackendConfig, createBackend } from '@anyko/backend/runtime';
import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import { createApp } from '../../../apps/api/src/http/app';
import { startJobWorker } from '../../../apps/worker/src/queues';
import type { DocumentAgents } from '../../../packages/backend/src/modules/agents';
import type {
  DocumentParser,
  SourceStorage,
} from '../../../packages/backend/src/modules/documents';

import { E2E_QUEUE_PREFIX, parseE2eConfig } from './config';

const env = parseE2eConfig(process.env);
const fixturePool = createDatabasePool(env.E2E_DATABASE_URL);
const fixtureDb = createDatabase(fixturePool);
const files = new Map<string, Uint8Array>();
const storage: SourceStorage = {
  put(key, bytes) {
    files.set(key, bytes.slice());
    return Promise.resolve();
  },
  get(key) {
    const bytes = files.get(key);
    if (!bytes) return Promise.reject(new Error('E2E_OBJECT_NOT_FOUND'));
    return Promise.resolve(bytes.slice());
  },
  delete(key) {
    files.delete(key);
    return Promise.resolve();
  },
  exists(key) {
    return Promise.resolve(files.has(key));
  },
};
const delay = () => Bun.sleep(env.E2E_PROCESSING_DELAY_MS);
let ocrHeld = false;
const ocrWaiters = new Set<() => void>();
function releaseOcr() {
  ocrHeld = false;
  for (const release of ocrWaiters) release();
  ocrWaiters.clear();
}
const parser: DocumentParser = {
  async parseDocument(_bytes, _format, attemptId) {
    await delay();
    if (ocrHeld) await new Promise<void>((resolve) => ocrWaiters.add(resolve));
    const attempt = await fixtureDb.processorAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    const document = await fixtureDb.sourceDocument.findFirstOrThrow({
      where: { id: attempt.documentId, workspaceId: attempt.workspaceId },
      select: { filename: true },
    });
    if (document.filename === 'fail.pdf') throw new Error('E2E_OCR_FAILURE');
    return {
      markdown: 'Имя: Анна. Номер: 42.',
      processorVersion: 'e2e-fixture',
      images: [],
    };
  },
  async eraseAttempt() {},
};
const agents: DocumentAgents = {
  async ready() {},
  async stop() {},
  async eraseThread() {},
  async describe() {
    await delay();
    return {
      description: 'Тестовое изображение',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  },
  async extract() {
    await delay();
    return { candidates: [], usage: { inputTokens: 0, outputTokens: 0 } };
  },
  async reconcile() {
    await delay();
    return {
      summary: 'Тестовый контекст',
      candidates: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  },
};
const config: BackendConfig = {
  database: { url: env.E2E_DATABASE_URL },
  storage: {
    endpoint: 'http://127.0.0.1:1',
    bucket: 'e2e',
    accessKeyId: 'e2e',
    secretAccessKey: 'e2e',
  },
  works: { encryptionKey: env.LLM_CONFIG_ENCRYPTION_KEY },
  auth: {
    secret: env.AUTH_SECRET,
    baseUrl: env.AUTH_BASE_URL,
    origin: env.APP_ORIGIN,
  },
  worker: {
    redisUrl: env.E2E_REDIS_URL,
    mineru: { baseUrl: 'http://127.0.0.1:1', timeoutMs: 240000 },
    shutdownTimeoutMs: 10000,
  },
};
const logger = createLogger({
  service: 'e2e',
  environment: 'test',
  release: 'e2e',
  level: 'warn',
});
const api = createBackend(config, {
  logger,
  role: 'api',
  dependencies: { storage, agents },
});
const worker = createBackend(config, {
  logger,
  role: 'worker',
  dependencies: { storage, agents, parser },
});
let app: { stop(): Promise<unknown> } | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  releaseOcr();
  await app?.stop();
  await Promise.allSettled([worker.stop(), api.stop()]);
  await fixtureDb.$disconnect();
  await fixturePool.end();
}
try {
  await Promise.all([api.ready(), worker.ready()]);
  const jobs = await startJobWorker(worker.jobs, {
    prefix: E2E_QUEUE_PREFIX,
    legacy: false,
  });
  app = createApp({
    logger,
    environment: 'test',
    documentHttp: api.documentHttp,
    workHttp: api.workHttp,
    ready: () => jobs.state() === 'ready',
  })
    .post('/__e2e/ocr/hold', () => {
      ocrHeld = true;
    })
    .post('/__e2e/ocr/release', releaseOcr)
    .get('/__e2e/ocr/cursor/:workspaceId/:workId', async ({ params }) => ({
      cursor:
        (
          await fixtureDb.workEvent.findFirst({
            where: { workspaceId: params.workspaceId, workId: params.workId },
            orderBy: { id: 'desc' },
          })
        )?.id.toString() ?? '0',
    }))
    .listen({
      hostname: '127.0.0.1',
      port: env.API_PORT,
      maxRequestBodySize: 21 * 1024 * 1024,
      idleTimeout: 30,
    });
  process.on('SIGINT', () => {
    void stop();
  });
  process.on('SIGTERM', () => {
    void stop();
  });
  if (process.platform === 'win32')
    process.on('SIGBREAK', () => {
      void stop();
    });
  console.info(`E2E backend listening on 127.0.0.1:${String(env.API_PORT)}`);
} catch (error) {
  await stop();
  throw error;
}
