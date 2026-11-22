import {
  createDatabase,
  createDatabasePool,
  createLockPool,
  createResourceLocks,
  type Database,
  type DatabasePool,
} from '@anyko/database';
import type { Logger } from '@anyko/logger';

import { createAccess, createWorkspaceActorScope } from '../modules/access';
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
import { createMineruParser } from '../modules/documents/infrastructure/mineru';
import {
  createReadyResults,
  lockDocumentRevisions,
} from '../modules/documents/infrastructure/ready-results';
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
import {
  claimDocumentAttempt,
  createJobProcessing,
} from '../modules/processing';
import { createProcessingIo } from '../modules/processing/infrastructure/io';
import { createJobRunReader } from '../modules/processing/infrastructure/job-store';
import {
  type NotifyDocumentRun,
  recoverRuns,
  runDelivery,
} from '../modules/processing/infrastructure/run-engine';
import { createDocumentProcessingStore } from '../modules/processing/infrastructure/store';
import { hasPackage } from '../modules/templates';
import { createTemplatePlaceholders } from '../modules/templates/infrastructure/template-placeholders';
import { createTemplateRequirements } from '../modules/templates/infrastructure/template-requirements';
import type { WorksModule } from '../modules/works';
import {
  createWorkStore,
  worksStoreFor,
} from '../modules/works/infrastructure/store';
import { createWorksModule } from '../modules/works/module';
import { systemClock } from '../platform/clock';
import { uuidV7 } from '../platform/ids';
import type { JobRuntime } from '../platform/jobs';
import { openTransaction, transactionHandle } from '../platform/transactions';
import { bflAnalysisPlan } from '../profiles/bfl/analysis-plan';
import { createDocumentDeletionWorkflow } from '../workflows/document-deletion';
import { createDocumentOcrWorkflow } from '../workflows/document-ocr';
import { createWorkChat, type WorkChat } from '../workflows/work-chat';
import type { WorkDependencies } from '../workflows/work-dependencies';
import { createWorkExecution } from '../workflows/work-execution';
import {
  createWorkGeneration,
  type WorkGeneration,
} from '../workflows/work-generation';
import { createWorkIntake, type WorkIntake } from '../workflows/work-intake';
import { advanceUploadGroups } from '../workflows/work-intake/advance-upload-groups';
import {
  createWorkCleanup,
  createWorkDeletionApi,
  type WorkDeletionApi,
} from '../workflows/work-maintenance';
import { createWorkReview, type WorkReview } from '../workflows/work-review';
import { createWorkView, type WorkViews } from '../workflows/work-view';

import { createChatProgressFeed } from './chat-progress';
import {
  type BackendConfig,
  BackendConfigError,
  validateBackendConfig,
} from './config';
import { createDatabaseEvents } from './database-events';
import {
  createDocumentUnitOfWork,
  finishDocumentDeletion,
} from './documents/unit-of-work';
import { createJobRegistry } from './jobs';
import { createUnitOfWork } from './transactions';
import {
  createResourceAwareIdempotencyStore,
  redactDeletedWorkResponses,
  redactWorkUploadResponses,
} from './works/idempotency';
import { createWorkProcessing } from './works/processing';

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
    subscribeEvents: import('../modules/works').SubscribeDatabaseEvents;
    // Фасад модуля works: список работ и события (запросы без сценария).
    works: WorksModule;
    views: WorkViews;
    chat: WorkChat;
    intake: WorkIntake;
    deletion: WorkDeletionApi;
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
  const listenUrl = validated.database.listenUrl;
  if (
    auth &&
    new URL(listenUrl ?? validated.database.url).searchParams.get(
      'pgbouncer',
    ) === 'true'
  )
    throw new BackendConfigError(
      'BACKEND_CONFIG_INVALID',
      'database.listenUrl must be direct',
    );

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
  const listenPool =
    auth && listenUrl ? createDatabasePool(listenUrl) : undefined;
  const databaseEvents = auth
    ? createDatabaseEvents(listenPool ?? pool)
    : undefined;
  const storage = dependencies.storage ?? createS3Storage(validated.storage);
  const io = createProcessingIo(db, uuidV7);
  const documents = createDocumentsModule({
    store: createDocumentUnitOfWork(db),
    storage,
    artifacts: createArtifactRegistry(db),
    locks,
    io,
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
    io,
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
  const processingFacade = createWorkProcessing(db, uow);
  const templatePlaceholders = createTemplatePlaceholders(db);
  const templateRequirements = createTemplateRequirements(db);

  let agentsDelegate: DocumentAgents | undefined = dependencies.agents;
  const agents = () =>
    (agentsDelegate ??= createDocumentAgents({
      pool,
      traceDirectory: validated.worker?.llmTraceDirectory,
      analysisMaxModelCalls: validated.worker?.analysisMaxModelCalls,
      analysisMaxReads: validated.worker?.analysisMaxReads,
      analysisReviewMaxReads: validated.worker?.analysisReviewMaxReads,
    }));
  // Внешние вызовы модели доступны только вне транзакционного фасада.
  const model: DocumentAgents = {
    chat: (input) => agents().chat(input),
    ready: () => agents().ready(),
    describe: (input) => agents().describe(input),
    extract: (input) => agents().extract(input),
    reconcile: (input) => agents().reconcile(input),
    runAnalysisStep: (input) => {
      const run = agents().runAnalysisStep;
      if (!run) throw new Error('STEPWISE_AGENT_UNAVAILABLE');
      return run(input);
    },
    eraseThread: (id) => agents().eraseThread(id),
    stop: async () => {
      await agentsDelegate?.stop();
    },
  };
  const agentsFacade = createAgentsModule({
    store: createAgentSessionStore(db, uuidV7, logger),
    storeFor: (tx) => agentSessionStoreFor(tx, uuidV7),
    model,
  });
  const documentDeletions = createDeletionStore(db);
  const chatProgress =
    validated.works.chatRedisUrl &&
    createChatProgressFeed(validated.works.chatRedisUrl);
  const work: WorkDependencies = {
    ...(validated.worker?.stepwiseAnalysis && {
      analysisPlan: bflAnalysisPlan,
    }),
    ...(chatProgress && { chatProgress }),
    newId: uuidV7,
    uow,
    works,
    facts,
    generation,
    templatePlaceholders,
    templateRequirements,
    processing: processingFacade,
    connections,
    agents: agentsFacade,
    documents,
    locks,
    io,
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
      if (chatProgress) chatProgress.close();
      if (databaseEvents) await attempt(() => databaseEvents.stop());
      if (listenPool) await attempt(() => listenPool.end());
      await attempt(() => lockPool.end());
      await attempt(() => work.agents.model.stop());
      await attempt(() => db.$disconnect());
      await attempt(() => pool.end());
      if (failures.length > 0) throw new Error('BACKEND_STOP_FAILED');
    })());

  if (auth && databaseEvents) {
    const access = createAccess({
      db,
      secret: auth.secret,
      baseURL: auth.baseUrl,
      origin: auth.origin,
    });
    const idempotency = createIdempotency({
      store: createResourceAwareIdempotencyStore(db, uow),
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
      templatePlaceholders,
      templateRequirements,
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
        subscribeEvents: databaseEvents.subscribe,
        works,
        views: createWorkView(workflows),
        chat: createWorkChat(work),
        intake: createWorkIntake({
          ...workflows,
          lockDocumentRevisions,
          redactWorkUploadResponses,
        }),
        deletion: createWorkDeletionApi({
          works,
          processing: processingFacade,
          locks,
          uow,
          clock: systemClock,
          audit,
          redactResponses: redactDeletedWorkResponses,
        }),
        review: createWorkReview(workflows),
        generation: createWorkGeneration({ ...workflows, clock: systemClock }),
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
  const notifyWork: NotifyDocumentRun = async (
    handle,
    workspaceId,
    documentId,
    revision,
  ) => {
    const tx = openTransaction(handle);
    const ready =
      revision !== undefined &&
      (await createReadyResults(
        transactionHandle<Pick<Database, '$queryRaw'>>(tx),
      )(workspaceId, documentId, revision));
    await works
      .in(tx)
      .internal.notifyDocumentChanged(
        workspaceId,
        documentId,
        ready ? revision : undefined,
      );
  };
  const processing = createDocumentProcessingStore(db, notifyWork);
  const deleteDocuments = createDocumentDeletionWorkflow({
    ...documentDeletions,
    resultKeys: processing.resultKeys,
    attemptIds: processing.attemptIds,
    eraseAttempt: parser.eraseAttempt.bind(parser),
    eraseThread: (id) => work.agents.model.eraseThread(id),
    finish: (workspaceId, documentId, keys, threadIds) =>
      finishDocumentDeletion(db, workspaceId, documentId, keys, threadIds),
    locks,
    storage,
    logger,
  });
  const ocrTimeoutMs = worker.mineru.timeoutMs + 60000;
  const jobProcessing = createJobProcessing(createJobRunReader(db));
  const cleanupWorks = createWorkCleanup(work, {
    clock: systemClock,
    sourcesDeleted: documentDeletions.completed,
  });
  const advanceUploads = advanceUploadGroups(work);
  const registry = createJobRegistry({
    processing: jobProcessing,
    ocr: {
      processing,
      io,
      locks,
      timeoutMs: ocrTimeoutMs,
      recognize: createDocumentOcrWorkflow({
        processing,
        claimAttempt: claimDocumentAttempt({
          store: processing,
          uow,
          clock: systemClock,
          newId: uuidV7,
          leaseMs: ocrTimeoutMs,
        }),
        artifacts: createArtifactRegistry(db),
        storage,
        parser,
        vision: model,
        connection: connections.internal.connection,
        logger,
      }),
    },
    execute: createWorkExecution(work, createWorkspaceActorScope(db)),
    maintain: async () => {
      await cleanupWorks();
      await advanceUploads();
    },
    documents: {
      processing,
      storage,
      deleteDocuments,
      cleanupSources: createSourceCleanup(db, storage),
    },
    idempotency: createIdempotencyMaintenance({
      store: createIdempotencyMaintenanceStore(db),
      clock: systemClock,
    }),
  });
  const delivery = runDelivery(db);
  return {
    role: 'worker',
    ready,
    stop,
    jobs: {
      registry,
      delivery: {
        ...delivery,
        describe: (item) =>
          jobProcessing.internal.read(item.workspaceId, item.runId),
      },
      reconcile: () =>
        db.$transaction((tx) =>
          recoverRuns(
            tx,
            registry.definitions.filter((job) => job.kind === 'run'),
            systemClock.now(),
            notifyWork,
          ),
        ),
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
