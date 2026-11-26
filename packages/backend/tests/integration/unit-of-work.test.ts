import { afterAll, expect, test } from 'bun:test';

import {
  createDatabase,
  createDatabasePool,
  createLockPool,
  createResourceLocks,
} from '@anyko/database';
import { createLogger } from '@anyko/logger';

import type { AuditWriter } from '../../src/modules/audit';
import type { SourceStorage } from '../../src/modules/documents';
import { emptyFacts } from '../../src/modules/facts';
import { factsStoreFor } from '../../src/modules/facts/infrastructure/store';
import { createWorkProcessingStore } from '../../src/modules/processing/infrastructure/work-store';
import { brandWorkId, uuidV7 } from '../../src/platform/ids';
import { createBackend } from '../../src/runtime';
import { createUnitOfWork } from '../../src/runtime/transactions';
import { changeWork } from '../../src/workflows/change-work';
import { integrationConfig } from '../support/composition';
import { memberScope } from '../support/scope';

// Единица работы: сбой внутри uow.run откатывает записи всех модулей, которые были сделаны в ней.
// Сценарий — старт генерации: результат, запуск, событие и журнал пишутся в одной транзакции.

const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !/^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(databaseUrl).pathname)
)
  throw new Error('Dedicated anyko_test TEST_DATABASE_URL required');
const redisUrl = process.env.TEST_REDIS_URL;
if (!redisUrl) throw new Error('TEST_REDIS_URL required');
const pool = createDatabasePool(databaseUrl);
const db = createDatabase(pool);
const lockPool = createLockPool(databaseUrl);
const runs = createWorkProcessingStore(db);
const logger = createLogger({
  service: 'api',
  environment: 'test',
  release: 'unit-of-work-integration',
  level: 'error',
});
// Исходники и внешние вызовы в этом сценарии не используются.
const unusedStorage: SourceStorage = {
  exists: () => Promise.reject(new Error('STORAGE_UNUSED')),
  put: () => Promise.reject(new Error('STORAGE_UNUSED')),
  get: () => Promise.reject(new Error('STORAGE_UNUSED')),
  delete: () => Promise.reject(new Error('STORAGE_UNUSED')),
};
const failingAudit: AuditWriter = () =>
  Promise.reject(new Error('SYNTHETIC_AUDIT_FAILURE'));

const config = integrationConfig({
  databaseUrl,
  redisUrl,
  encryptionKey: 'e'.repeat(64),
});
const failing = createBackend(config, {
  logger,
  role: 'api',
  dependencies: { storage: unusedStorage, auditWriter: failingAudit },
});
const normal = createBackend(config, {
  logger,
  role: 'api',
  dependencies: { storage: unusedStorage },
});
const owned: string[] = [];

async function workspaceWithWork(packageVersion = 'technical-document-v1') {
  const workspaceId = crypto.randomUUID();
  owned.push(workspaceId);
  await db.anykoWorkspace.create({
    data: { id: workspaceId, name: 'Synthetic unit of work' },
  });
  const scope = memberScope(workspaceId, 'fixture');
  const workId = await normal.workHttp.intake.createWork(scope, {
    title: 'Синтетическая работа',
    packageVersion,
  });
  const view = await normal.workHttp.views.get(scope, workId);
  return { workspaceId, workId, revision: view.work.revision };
}

async function failureOf(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
}

async function rejects(operation: Promise<unknown>, message: string) {
  expect(await failureOf(operation)).toMatchObject({ message });
}

afterAll(async () => {
  await failing.stop();
  await normal.stop();
  const where = { workspaceId: { in: owned } };
  await db.workGenerationFile.deleteMany({ where });
  await db.workGeneration.deleteMany({ where });
  await db.workArtifact.deleteMany({ where });
  await db.workEvent.deleteMany({ where });
  await db.run.deleteMany({ where });
  await db.processingIo.deleteMany({ where });
  await db.workFacts.deleteMany({ where });
  await db.work.deleteMany({ where });
  await db.auditEvent.deleteMany({ where });
  await db.anykoWorkspace.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
  await pool.end();
  await lockPool.end();
});

test('a failed audit write leaves no generation result, run or event', async () => {
  const { workspaceId, workId, revision } = await workspaceWithWork();
  const scope = memberScope(workspaceId, 'fixture');
  await rejects(
    failing.workHttp.generation.startGeneration(scope, {
      workId: brandWorkId(workId),
      revision,
      correlationId: crypto.randomUUID(),
    }),
    'SYNTHETIC_AUDIT_FAILURE',
  );
  expect(
    await db.workGeneration.count({ where: { workspaceId, workId } }),
  ).toBe(0);
  expect(
    await db.workGenerationFile.count({ where: { workspaceId, workId } }),
  ).toBe(0);
  expect(await db.run.count({ where: { workspaceId, workId } })).toBe(0);
  expect(
    await db.workEvent.count({
      where: { workspaceId, workId, kind: 'generation.queued' },
    }),
  ).toBe(0);
  expect(await db.auditEvent.count({ where: { workspaceId } })).toBe(0);
});

test('the same start with a working audit writes the result, the run, the event and the journal together', async () => {
  const { workspaceId, workId, revision } = await workspaceWithWork();
  const scope = memberScope(workspaceId, 'fixture');
  await normal.workHttp.generation.startGeneration(scope, {
    workId: brandWorkId(workId),
    revision,
    correlationId: crypto.randomUUID(),
  });
  expect(
    await db.workGeneration.count({ where: { workspaceId, workId } }),
  ).toBe(1);
  expect(await db.run.count({ where: { workspaceId, workId } })).toBe(1);
  expect(
    await db.workEvent.count({
      where: { workspaceId, workId, kind: 'generation.queued' },
    }),
  ).toBe(1);
  expect(
    await db.auditEvent.count({
      where: { workspaceId, action: 'generation.started' },
    }),
  ).toBe(1);
});

const changeDeps = {
  works: normal.workHttp.works,
  locks: createResourceLocks(lockPool),
  uow: createUnitOfWork(db),
  processing: {
    queries: {
      isActive: (scope: ReturnType<typeof memberScope>, workId: string) =>
        runs.active(scope.workspaceId, workId),
    },
  },
};

test.each([
  { cleanup: true, stale: true, code: 'CLEANUP_PENDING' },
  { cleanup: false, stale: true, code: 'REVISION_CONFLICT' },
  { cleanup: false, stale: false, code: 'WORK_BUSY' },
])(
  'change work rejects $code before saving an effect, revision or event',
  async ({ cleanup, stale, code }) => {
    const { workspaceId, workId, revision } = await workspaceWithWork();
    const scope = memberScope(workspaceId);
    const id = brandWorkId(workId);
    await normal.workHttp.generation.startGeneration(scope, {
      workId: id,
      revision,
      correlationId: crypto.randomUUID(),
    });
    if (cleanup)
      await db.processingIo.create({
        data: {
          id: uuidV7(),
          kind: 'work',
          workspaceId,
          workId,
          uncertain: true,
        },
      });

    const where = { workspaceId, workId };
    expect(
      await failureOf(
        changeWork(
          changeDeps,
          scope,
          {
            workId: id,
            expectedRevision: stale ? revision - 1 : revision,
            command: 'confirm',
            advance: 'draft',
            event: 'facts.changed',
          },
          () => (tx) =>
            factsStoreFor(tx).save(workspaceId, workId, emptyFacts()),
        ),
      ),
    ).toMatchObject({ code });
    expect(await db.workFacts.count({ where })).toBe(0);
    expect(
      await db.workEvent.count({ where: { ...where, kind: 'facts.changed' } }),
    ).toBe(0);
    expect(await normal.workHttp.works.queries.find(scope, id)).toMatchObject({
      revision,
    });
  },
);

test('two concurrent changes of the same revision save one effect, one revision and one event', async () => {
  const { workspaceId, workId, revision } = await workspaceWithWork();
  const scope = memberScope(workspaceId);
  const id = brandWorkId(workId);
  const save = (personName: string) =>
    changeWork(
      changeDeps,
      scope,
      {
        workId: id,
        expectedRevision: revision,
        command: 'edit',
        advance: 'draft',
        event: 'facts.changed',
      },
      () => (tx) => {
        const facts = emptyFacts();
        facts.values.personName = personName;
        return factsStoreFor(tx).save(workspaceId, workId, facts);
      },
    );

  const first = 'Первое имя';
  const second = 'Второе имя';
  const results = await Promise.allSettled([save(first), save(second)]);
  expect(results).toContainEqual({ status: 'fulfilled', value: undefined });
  const rejected = results.find((result) => result.status === 'rejected');
  const reason: unknown = rejected?.reason;
  expect(reason).toMatchObject({ code: 'REVISION_CONFLICT' });
  const view = await normal.workHttp.views.get(scope, id);
  expect(view.facts.values.personName).toBe(
    results[0].status === 'fulfilled' ? first : second,
  );
  expect(view.work.revision).toBe(revision + 1);
  const events = await normal.workHttp.works.queries.events(scope, id, '0');
  expect(events.filter((event) => event.kind === 'facts.changed')).toHaveLength(
    1,
  );
});

test.each([
  { phase: 'before write', inside: false, delayNotification: false },
  { phase: 'inside transaction', inside: true, delayNotification: false },
  {
    phase: 'before the callback is notified',
    inside: false,
    delayNotification: true,
  },
])(
  'losing the work lock $phase leaves no stale effect, revision or event',
  async ({ inside, delayNotification }) => {
    const { workspaceId, workId, revision } = await workspaceWithWork();
    const scope = memberScope(workspaceId);
    const id = brandWorkId(workId);
    const applicationName = `anyko-lock-test-${uuidV7()}`;
    const lockUrl = new URL(databaseUrl);
    lockUrl.searchParams.set('application_name', applicationName);
    const doomedPool = createLockPool(lockUrl.href);
    const doomedLocks = createResourceLocks(doomedPool);
    const paused = Promise.withResolvers<true>();
    const resume = Promise.withResolvers<true>();
    const aborted = Promise.withResolvers<true>();
    const pause = async () => {
      paused.resolve(true);
      await resume.promise;
    };
    const loser = failureOf(
      changeWork(
        {
          ...changeDeps,
          locks: {
            run: (key, operation) =>
              doomedLocks.run(key, (signal) => {
                signal.addEventListener(
                  'abort',
                  () => {
                    aborted.resolve(true);
                  },
                  { once: true },
                );
                return operation(
                  delayNotification ? new AbortController().signal : signal,
                );
              }),
          },
        },
        scope,
        {
          workId: id,
          expectedRevision: revision,
          command: 'edit',
          advance: 'draft',
          event: 'facts.changed',
        },
        async () => {
          if (!inside) await pause();
          return async (tx) => {
            const facts = emptyFacts();
            facts.values.personName = 'Устаревшее имя';
            await factsStoreFor(tx).save(workspaceId, workId, facts);
            if (inside) await pause();
          };
        },
      ),
    );
    try {
      await paused.promise;
      const { rows } = await pool.query<{ terminated: boolean }>(
        `SELECT pg_terminate_backend(activity.pid) AS terminated
           FROM pg_stat_activity AS activity
           WHERE activity.datname = current_database() AND activity.application_name = $1
             AND EXISTS (
               SELECT 1 FROM pg_locks AS locks
               WHERE locks.pid = activity.pid AND locks.locktype = 'advisory' AND locks.granted
             )`,
        [applicationName],
      );
      expect(rows).toEqual([{ terminated: true }]);
      await aborted.promise;
      const winner = !inside;
      if (winner)
        await normal.workHttp.review.editValues(scope, {
          workId: id,
          revision,
          values: { ...emptyFacts().values, personName: 'Сохранённое имя' },
        });
      resume.resolve(true);
      const failure = await loser;
      const final = await normal.workHttp.views.get(scope, id);
      expect(final.facts.values.personName).toBe(
        winner ? 'Сохранённое имя' : null,
      );
      expect(final.work.revision).toBe(winner ? revision + 1 : revision);
      const events = await normal.workHttp.works.queries.events(scope, id, '0');
      expect(
        events.filter((event) => event.kind === 'facts.changed'),
      ).toHaveLength(winner ? 1 : 0);
      expect(failure).toMatchObject({ code: 'REVISION_CONFLICT' });
    } finally {
      resume.resolve(true);
      await loser;
      await doomedPool.end();
    }
  },
);

test('an unknown fact table column fails validation and leaves the saved work untouched', async () => {
  const { workspaceId, workId, revision } =
    await workspaceWithWork('bfl-bankruptcy-v14');
  const scope = memberScope(workspaceId);
  const id = brandWorkId(workId);
  const before = await normal.workHttp.views.get(scope, id);

  expect(
    await failureOf(
      normal.workHttp.review.editValues(scope, {
        workId: id,
        revision,
        values: { ...emptyFacts().values, debts: [{ rogue: 'x' }] },
      }),
    ),
  ).toMatchObject({
    code: 'INVALID_WORK_INPUT',
    fields: [{ path: ['values', 'debts', 0, 'rogue'], code: 'invalid_value' }],
  });
  expect(await normal.workHttp.views.get(scope, id)).toEqual(before);
});
