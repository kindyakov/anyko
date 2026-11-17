import {
  createDatabase,
  createDatabasePool,
  createLockPool,
  createResourceLocks,
  type Database,
  type DatabasePool,
} from '@anyko/database';
import type { Logger } from '@anyko/logger';

import { createAccess } from '../modules/access';
import type { DocumentAgents } from '../modules/agents';
import { createDocumentAgents } from '../modules/agents/infrastructure/mastra';
import {
  agentSessionStoreFor,
  createAgentSessionStore,
} from '../modules/agents/infrastructure/session-store';
import { type AuditWriter, record } from '../modules/audit';
import { createAuditModule } from '../modules/audit/module';
import {
  createDocumentService,
  createRecognitions,
  type DocumentParser,
  type RecognitionService,
  type SourceStorage,
} from '../modules/documents';
import { createArtifactRegistry } from '../modules/documents/infrastructure/artifact-store';
import { createDeletionStore } from '../modules/documents/infrastructure/deletion-store';
import { createDocumentIo } from '../modules/documents/infrastructure/document-io';
import { createMineruParser } from '../modules/documents/infrastructure/mineru';
import { createS3Storage } from '../modules/documents/infrastructure/s3-storage';
import { createSourceCleanup } from '../modules/documents/infrastructure/source-cleanup';
import {
  createFactsStore,
  factsStoreFor,
} from '../modules/facts/infrastructure/store';
import { createFactsModule } from '../modules/facts/module';
import {
  createGenerationStore,
  generationStoreFor,
} from '../modules/generation/infrastructure/store';
import { createGenerationModule } from '../modules/generation/module';
import { createIdempotency, type IdempotencyApi } from '../modules/idempotency';
import { createIdempotencyStore } from '../modules/idempotency/infrastructure/store';
import {
  createLlmSettings,
  createProcessingService,
  type LlmSettingsApi,
} from '../modules/processing';
import { createLlmSettingsStore } from '../modules/processing/infrastructure/settings-store';
import { createProcessingStore } from '../modules/processing/infrastructure/store';
import {
  createWorkProcessingStore,
  workProcessingStoreFor,
} from '../modules/processing/infrastructure/work-store';
import { createProcessingModule } from '../modules/processing/module';
import { hasPackage } from '../modules/templates';
import type { WorksModule } from '../modules/works';
import {
  createWorkStore,
  worksStoreFor,
} from '../modules/works/infrastructure/store';
import { createWorkIo } from '../modules/works/infrastructure/work-io';
import { createWorksModule } from '../modules/works/module';
import { systemClock } from '../platform/clock';
import { uuidV7 } from '../platform/ids';
import type { Tx } from '../platform/transactions';
import { createDocumentDeletionWorkflow } from '../workflows/document-deletion';
import { createDocumentOcrWorkflow } from '../workflows/document-ocr';
import {
  createWorkGeneration,
  type WorkGeneration,
} from '../workflows/work-generation';
import { createWorkIntake, type WorkIntake } from '../workflows/work-intake';
import { createWorkReview, type WorkReview } from '../workflows/work-review';
import { createWorkView, type WorkViews } from '../workflows/work-view';
import type { WorkDependencies, WorkStores } from '../workflows/works/ports';

import {
  type BackendConfig,
  BackendConfigError,
  validateBackendConfig,
} from './config';
import {
  createDocumentUnitOfWork,
  finishDocumentDeletion,
} from './documents/unit-of-work';
import { createDocumentWorker } from './documents/worker';
import { createUnitOfWork } from './transactions';
import { createWorkWorker } from './works/worker';

interface QueueStartOptions {
  /** Overrides the production queue name; integration tests use isolated queues. */
  queueName?: string;
}

/**
 * Test seams: each one replaces an external client. Production passes nothing, so the
 * defaults are the only clients the process creates.
 */
interface BackendDependencies {
  createPool?(url: string): DatabasePool;
  createLockPool?(url: string): DatabasePool;
  createDatabase?(pool: DatabasePool): Database;
  storage?: SourceStorage;
  parser?: DocumentParser;
  agents?: DocumentAgents;
  // Способ записи журнала действий: тест подменяет его, чтобы проверить откат транзакции.
  auditWriter?: AuditWriter;
}

export interface BackendOptions<Role extends 'api' | 'worker'> {
  logger: Logger;
  role: Role;
  dependencies?: BackendDependencies;
}

export interface ApiBackend {
  readonly role: 'api';
  readonly documentHttp: {
    documents: RecognitionService;
    access: ReturnType<typeof createAccess>;
    origin: string;
    idempotency: IdempotencyApi;
  };
  readonly workHttp: {
    // Фасад модуля works: список работ и события (запросы без сценария).
    works: WorksModule;
    views: WorkViews;
    intake: WorkIntake;
    review: WorkReview;
    generation: WorkGeneration;
    settings: LlmSettingsApi;
    documents: RecognitionService;
    access: ReturnType<typeof createAccess>;
    origin: string;
    idempotency: IdempotencyApi;
  };
  ready(): Promise<void>;
  stop(): Promise<void>;
}

export interface WorkerBackend {
  readonly role: 'worker';
  ready(): Promise<void>;
  startDocumentWorker(
    options?: QueueStartOptions,
  ): ReturnType<typeof createDocumentWorker>;
  startWorkWorker(
    options?: QueueStartOptions,
  ): ReturnType<typeof createWorkWorker>;
  stop(): Promise<void>;
}

/** Process composition root: one pool, one Prisma client, one S3 client, one lock set. */
export function createBackend(
  config: BackendConfig,
  options: BackendOptions<'api'>,
): ApiBackend;
export function createBackend(
  config: BackendConfig,
  options: BackendOptions<'worker'>,
): WorkerBackend;
export function createBackend(
  config: BackendConfig,
  options: BackendOptions<'api' | 'worker'>,
): ApiBackend | WorkerBackend {
  const { logger, role, dependencies = {} } = options;
  const validated = validateBackendConfig(config);
  const auth = role === 'api' ? validated.auth : undefined;
  const worker = role === 'worker' ? validated.worker : undefined;
  if (role === 'api' && !auth)
    throw new BackendConfigError('BACKEND_CONFIG_MISSING', 'auth');
  if (role === 'worker' && !worker)
    throw new BackendConfigError('BACKEND_CONFIG_MISSING', 'worker');

  // Two pools per process, both for the same database: queries (Prisma, agent store) and
  // session locks. A lock holder keeps its connection through external I/O, so it must not
  // share connections with the queries it runs (see createLockPool in packages/database).
  const pool = (dependencies.createPool ?? createDatabasePool)(
    validated.database.url,
  );
  const lockPool = (dependencies.createLockPool ?? createLockPool)(
    validated.database.url,
  );
  const db = (dependencies.createDatabase ?? createDatabase)(pool);
  const locks = createResourceLocks(lockPool);
  const storage = dependencies.storage ?? createS3Storage(validated.storage);
  const documents = createDocumentService(
    createDocumentUnitOfWork(db),
    storage,
    logger,
    createArtifactRegistry(db),
    locks,
    createDocumentIo(db),
  );

  // Единица работы и фасады модулей: сценарии получают их, а не клиента БД.
  const uow = createUnitOfWork(db);
  const llmSettings = createLlmSettingsStore(db, validated.works.encryptionKey);
  const audit = createAuditModule({
    connection: db,
    write: dependencies.auditWriter ?? record,
  });
  const works = createWorksModule({
    store: createWorkStore(db),
    storeFor: worksStoreFor,
    io: createWorkIo(db),
    newId: uuidV7,
    knownPackage: hasPackage,
  });
  const facts = createFactsModule({
    store: createFactsStore(db),
    storeFor: factsStoreFor,
  });
  const generation = createGenerationModule({
    store: createGenerationStore(db),
    storeFor: generationStoreFor,
    newId: uuidV7,
  });
  const processingFacade = createProcessingModule({
    store: createWorkProcessingStore(db),
    storeFor: workProcessingStoreFor,
    settings: llmSettings,
    newId: uuidV7,
  });

  let agentsDelegate: DocumentAgents | undefined = dependencies.agents;
  const agents = () => (agentsDelegate ??= createDocumentAgents({ pool }));
  // Мост для процессов 5b (execute, continue-session, cleanup): наборы хранилищ внутри транзакции.
  const bridgeStores = (tx: Tx): WorkStores => ({
    sessions: agentSessionStoreFor(tx),
    works: worksStoreFor(tx),
    facts: factsStoreFor(tx),
    generation: generationStoreFor(tx),
    processing: workProcessingStoreFor(tx),
    audit: audit.in(tx).commands,
  });
  const work: WorkDependencies = {
    sessions: createAgentSessionStore(db),
    works: createWorkStore(db),
    facts: createFactsStore(db),
    generation: createGenerationStore(db),
    processing: createWorkProcessingStore(db),
    audit: audit.commands,
    transaction: (operation) => uow.run((tx) => operation(bridgeStores(tx))),
    documents,
    settings: llmSettings,
    locks,
    documentIo: createDocumentIo(db),
    workIo: createWorkIo(db),
    assertNoDocumentWriters: (workspaceId, documentId, requestKey) =>
      createDeletionStore(db).assertNoWriters(
        workspaceId,
        documentId,
        requestKey,
      ),
    agents: {
      ready: () => agents().ready(),
      describe: (input) => agents().describe(input),
      extract: (input) => agents().extract(input),
      reconcile: (input) => agents().reconcile(input),
      eraseThread: (id) => agents().eraseThread(id),
      stop: async () => {
        await agentsDelegate?.stop();
      },
    },
    storage,
    logger,
  };
  const recognitions = createRecognitions(documents);

  const started: { stop(): Promise<void> }[] = [];
  let stopping: Promise<void> | undefined;
  const ready = async () => {
    await storage.ready?.();
    await db.$queryRaw`SELECT 1`;
    if (role === 'worker') await work.agents.ready();
  };
  const stop = () =>
    (stopping ??= (async () => {
      // Reverse of creation: queues (the only holders of locks in workers), then the lock
      // pool, agents, database connection, and finally the query pool. Every step runs even
      // if an earlier one fails, so both pools are always ended.
      const failures: unknown[] = [];
      const attempt = async (close: () => Promise<unknown>) => {
        try {
          await close();
        } catch (error) {
          failures.push(error);
        }
      };
      for (const handle of [...started].reverse())
        await attempt(() => handle.stop());
      await attempt(() => lockPool.end());
      await attempt(() => work.agents.stop());
      await attempt(() => db.$disconnect());
      await attempt(() => pool.end());
      if (failures.length > 0) throw new Error('BACKEND_STOP_FAILED');
    })());

  if (auth) {
    const access = createAccess({
      db,
      secret: auth.secret,
      baseURL: auth.baseUrl,
      origin: auth.origin,
    });
    const idempotency = createIdempotency({
      store: createIdempotencyStore(db),
      clock: systemClock,
      newToken: uuidV7,
      logger,
    });
    const workflows = {
      uow,
      works,
      facts,
      processing: processingFacade,
      generation,
      audit,
      storage,
      locks,
      documents,
    };
    return {
      role: 'api',
      documentHttp: {
        documents: recognitions,
        access,
        origin: auth.origin,
        idempotency,
      },
      workHttp: {
        works,
        views: createWorkView({
          ...workflows,
          sessions: createAgentSessionStore(db),
        }),
        intake: createWorkIntake({
          ...workflows,
          sessions: { in: agentSessionStoreFor },
        }),
        review: createWorkReview(workflows),
        generation: createWorkGeneration(workflows),
        settings: createLlmSettings({ settings: llmSettings, locks }),
        documents: recognitions,
        access,
        origin: auth.origin,
        idempotency,
      },
      ready,
      stop,
    };
  }

  if (!worker) throw new BackendConfigError('BACKEND_CONFIG_MISSING', 'worker');
  const parser =
    dependencies.parser ??
    createMineruParser({
      baseUrl: worker.mineru.baseUrl,
      timeoutMs: worker.mineru.timeoutMs,
    });
  const processing = createProcessingService(createProcessingStore(db));
  const deleteDocuments = createDocumentDeletionWorkflow({
    ...createDeletionStore(db),
    resultKeys: processing.resultKeys,
    attemptIds: processing.attemptIds,
    eraseAttempt: (id) => parser.eraseAttempt(id),
    finish: (workspaceId, documentId, keys) =>
      finishDocumentDeletion(db, workspaceId, documentId, keys),
    locks,
    storage,
    logger,
  });
  const documentDeps = {
    processing,
    io: createDocumentIo(db),
    locks,
    storage,
    logger,
    execute: createDocumentOcrWorkflow({
      processing,
      artifacts: createArtifactRegistry(db),
      storage,
      parser,
      logger,
      leaseMs: worker.mineru.timeoutMs + 60000,
    }),
    deleteDocuments,
    cleanupSources: createSourceCleanup(db, storage),
  };
  return {
    role: 'worker',
    ready,
    async startDocumentWorker(input) {
      const handle = await createDocumentWorker({
        deps: documentDeps,
        redisUrl: worker.redisUrl,
        logger,
        queueName: input?.queueName ?? 'anyko-document-ocr',
        shutdownTimeoutMs: worker.shutdownTimeoutMs,
      });
      started.push(handle);
      return handle;
    },
    async startWorkWorker(input) {
      const handle = await createWorkWorker({
        deps: work,
        redisUrl: worker.redisUrl,
        logger,
        queueName: input?.queueName ?? 'anyko-work-pipeline',
        shutdownTimeoutMs: worker.shutdownTimeoutMs,
      });
      started.push(handle);
      return handle;
    },
    stop,
  };
}
