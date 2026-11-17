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
import { createAgentsModule } from '../modules/agents/module';
import { type AuditWriter, record } from '../modules/audit';
import { createAuditModule } from '../modules/audit/module';
import type { ConnectionSettingsApi } from '../modules/connections';
import {
  connectionsStoreFor,
  createConnectionsStore,
} from '../modules/connections/infrastructure/store';
import { createConnectionsModule } from '../modules/connections/module';
import type {
  DocumentParser,
  DocumentsModule,
  SourceStorage,
} from '../modules/documents';
import { createArtifactRegistry } from '../modules/documents/infrastructure/artifact-store';
import { createDeletionStore } from '../modules/documents/infrastructure/deletion-store';
import { createDocumentIo } from '../modules/documents/infrastructure/document-io';
import { createMineruParser } from '../modules/documents/infrastructure/mineru';
import { createS3Storage } from '../modules/documents/infrastructure/s3-storage';
import { createSourceCleanup } from '../modules/documents/infrastructure/source-cleanup';
import { createDocumentsModule } from '../modules/documents/module';
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
import {
  createIdempotency,
  createIdempotencyMaintenance,
  type IdempotencyApi,
} from '../modules/idempotency';
import { createIdempotencyMaintenanceStore } from '../modules/idempotency/infrastructure/maintenance-store';
import { createIdempotencyStore } from '../modules/idempotency/infrastructure/store';
import {
  createJobProcessing,
  createProcessingService,
} from '../modules/processing';
import { createJobRunReader } from '../modules/processing/infrastructure/job-store';
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
import type { JobRuntime } from '../platform/jobs';
import { openTransaction } from '../platform/transactions';
import { createDocumentDeletionWorkflow } from '../workflows/document-deletion';
import { createDocumentOcrWorkflow } from '../workflows/document-ocr';
import type { WorkDependencies } from '../workflows/work-dependencies';
import { createWorkExecution } from '../workflows/work-execution';
import {
  createWorkGeneration,
  type WorkGeneration,
} from '../workflows/work-generation';
import { createWorkIntake, type WorkIntake } from '../workflows/work-intake';
import { createWorkCleanup } from '../workflows/work-maintenance';
import { createWorkReview, type WorkReview } from '../workflows/work-review';
import { createWorkView, type WorkViews } from '../workflows/work-view';

import {
  type BackendConfig,
  BackendConfigError,
  validateBackendConfig,
} from './config';
import {
  createDocumentUnitOfWork,
  finishDocumentDeletion,
} from './documents/unit-of-work';
import { createJobRegistry } from './jobs';
import { createUnitOfWork } from './transactions';

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
    documents: DocumentsModule;
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
    settings: ConnectionSettingsApi;
    documents: DocumentsModule;
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
  readonly jobs: JobRuntime;
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
  const documents = createDocumentsModule({
    store: createDocumentUnitOfWork(db),
    storage,
    artifacts: createArtifactRegistry(db),
    locks,
    io: createDocumentIo(db, uuidV7),
    logger,
    newId: uuidV7,
  });

  // Единица работы и фасады модулей: сценарии получают их, а не клиента БД.
  const uow = createUnitOfWork(db);
  const audit = createAuditModule({
    connection: db,
    write: dependencies.auditWriter ?? record,
  });
  const connections = createConnectionsModule({
    store: createConnectionsStore(db, validated.works.encryptionKey),
    storeFor: (tx) => connectionsStoreFor(tx, validated.works.encryptionKey),
    uow,
    audit,
    clock: systemClock,
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
    newId: uuidV7,
  });

  let agentsDelegate: DocumentAgents | undefined = dependencies.agents;
  const agents = () => (agentsDelegate ??= createDocumentAgents({ pool }));
  // Внешние вызовы модели доступны только вне транзакционного фасада.
  const model: DocumentAgents = {
    ready: () => agents().ready(),
    describe: (input) => agents().describe(input),
    extract: (input) => agents().extract(input),
    reconcile: (input) => agents().reconcile(input),
    eraseThread: (id) => agents().eraseThread(id),
    stop: async () => {
      await agentsDelegate?.stop();
    },
  };
  const agentsFacade = createAgentsModule({
    store: createAgentSessionStore(db, uuidV7),
    storeFor: (tx) => agentSessionStoreFor(tx, uuidV7),
    model,
  });
  const work: WorkDependencies = {
    newId: uuidV7,
    uow,
    works,
    facts,
    generation,
    processing: processingFacade,
    connections,
    agents: agentsFacade,
    documents,
    locks,
    documentIo: createDocumentIo(db, uuidV7),
    workIo: createWorkIo(db),
    assertNoDocumentWriters: (workspaceId, documentId, requestKey) =>
      createDeletionStore(db).assertNoWriters(
        workspaceId,
        documentId,
        requestKey,
      ),
    storage,
    logger,
  };

  const started: { stop(): Promise<void> }[] = [];
  let stopping: Promise<void> | undefined;
  const ready = async () => {
    await storage.ready?.();
    await db.$queryRaw`SELECT 1`;
    if (role === 'worker') await work.agents.model.ready();
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
      await attempt(() => work.agents.model.stop());
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
      connections,
      generation,
      audit,
      storage,
      locks,
      documents,
      agents: agentsFacade,
    };
    return {
      role: 'api',
      documentHttp: {
        documents,
        access,
        origin: auth.origin,
        idempotency,
      },
      workHttp: {
        works,
        views: createWorkView(workflows),
        intake: createWorkIntake(workflows),
        review: createWorkReview(workflows),
        generation: createWorkGeneration(workflows),
        settings: { ...connections.queries, ...connections.commands },
        documents,
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
  const processing = createProcessingService(
    createProcessingStore(db, async (handle, workspaceId, documentId) => {
      const work = works.in(openTransaction(handle)).internal;
      const workId = await work.workForDocument(workspaceId, documentId);
      if (workId) await work.event(workspaceId, workId, 'documents.changed');
    }),
    {
      clock: systemClock,
      newId: uuidV7,
    },
  );
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
    io: createDocumentIo(db, uuidV7),
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
  const jobProcessing = createJobProcessing(createJobRunReader(db));
  const executeWork = createWorkExecution(work);
  const cleanupWork = createWorkCleanup(work);
  return {
    role: 'worker',
    ready,
    stop,
    jobs: {
      registry: createJobRegistry({
        processing: jobProcessing,
        ocr: async (scope, signal) => {
          const documentId = await processing.documentId(
            scope.workspaceId,
            scope.runId,
          );
          if (documentId)
            await locks.run(
              `document:${scope.workspaceId}:${documentId}`,
              (lockSignal) =>
                documentDeps.io.run(
                  { workspaceId: scope.workspaceId, documentId },
                  () =>
                    documentDeps.execute(
                      scope,
                      AbortSignal.any([signal, lockSignal]),
                    ),
                ),
            );
        },
        execute: (scope, signal) =>
          executeWork(scope.workspaceId, scope.runId, signal),
        maintain: cleanupWork,
        documents: documentDeps,
        idempotency: createIdempotencyMaintenance({
          store: createIdempotencyMaintenanceStore(db),
          clock: systemClock,
        }),
        ocrTimeoutMs: worker.mineru.timeoutMs + 60000,
      }),
      deliveries: [
        {
          reserve: () => processing.reserveDelivery(),
          describe: (item) =>
            jobProcessing.internal.read(
              item.workspaceId,
              item.runId,
              'document',
            ),
          delivered: processing.delivered,
          release: processing.releaseDelivery,
        },
        {
          reserve: () => processingFacade.internal.delivery(),
          describe: (item) =>
            jobProcessing.internal.read(item.workspaceId, item.runId, 'work'),
          delivered: (id, token) =>
            processingFacade.internal.delivered(id, token),
          release: (id, token) => processingFacade.internal.release(id, token),
        },
      ],
      reconcile: async () => {
        await processing.reconcile();
        await processingFacade.internal.reconcile();
      },
      clock: systemClock,
      newId: uuidV7,
      logger,
      redisUrl: worker.redisUrl,
      shutdownTimeoutMs: worker.shutdownTimeoutMs,
      track: (handle) => {
        started.push(handle);
      },
    },
  };
}
