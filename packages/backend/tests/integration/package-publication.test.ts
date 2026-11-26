import { afterAll, afterEach, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';

import {
  debtClaimProfile,
  registerDebtClaim,
  unregisterDebtClaim,
} from '../../../../tests/integration/worker/support/debt-claim';
import { publishPackages } from '../../src/modules/templates/infrastructure/publish-packages';
import { createBackend } from '../../src/runtime';
import { createProcessingProfiles } from '../../src/runtime/processing-profiles';
import {
  loadPublishedProcessingProfiles,
  publishCatalog,
  publishRegisteredPackages,
} from '../../src/runtime/publish-packages';
import { integrationConfig } from '../support/composition';
import { memberScope } from '../support/scope';

const url = process.env.TEST_DATABASE_URL;
if (!url || !/^\/anyko_test(?:_[a-z0-9_]+)?$/u.test(new URL(url).pathname))
  throw new Error('Dedicated TEST_DATABASE_URL is required');
const databaseUrl = url;
const pool = createDatabasePool(url);
const db = createDatabase(pool);
const profiles = createProcessingProfiles(false, [debtClaimProfile]);
const registered = profiles.publications
  .filter(({ profile }) => profile.id === debtClaimProfile.id)
  .map((description) => ({
    description,
    templateBytes: profiles.resolve(description.package.version).templateBytes,
  }));
const [first, second] = registered;
if (!first || !second) throw new Error('Expected two test packages');

afterEach(() => unregisterDebtClaim(db));
afterAll(async () => {
  await db.$disconnect();
  await pool.end();
});

test('concurrent identical publications have one writer and one no-op', async () => {
  const results = await Promise.all([
    registerDebtClaim(db),
    registerDebtClaim(db),
  ]);
  for (const version of ['test-debt-claim-v1', 'test-debt-claim-v2']) {
    expect(
      results
        .flat()
        .filter((entry) => entry.version === version)
        .map(({ status }) => status)
        .sort(),
    ).toEqual(['created', 'unchanged']);
  }
  const stored = await db.documentPackageVersion.findUniqueOrThrow({
    where: { version: 'test-debt-claim-v1' },
  });
  expect(stored.descriptionHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(stored.description).toContain('"id":"test-debt-claim"');
});

test('changed content under the same version rolls back the whole batch', async () => {
  await publishPackages(db, [second]);
  const conflict = structuredClone(second.description);
  conflict.analysis.instructions = {
    chat: 'Changed',
    extraction: '',
    reconciliation: '',
    reconciliationWithChecklist: '',
  };
  const error = await publishPackages(db, [
    first,
    { ...second, description: conflict },
  ]).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toContain('Catalog version differs');
  expect(
    await db.documentPackageVersion.findUnique({
      where: { version: 'test-debt-claim-v1' },
    }),
  ).toBeNull();
  expect(
    await db.documentTemplateVersion.findUnique({
      where: { version: 'test-debt-claim-template-v1' },
    }),
  ).toBeNull();
  expect(await publishPackages(db, [second])).toEqual([
    { version: 'test-debt-claim-v2', status: 'unchanged' },
  ]);
});

test('legacy rows are adopted only after matching their bindings and document links', async () => {
  await publishPackages(db, [first]);
  const version = 'test-debt-claim-v1';
  const templateVersion = 'test-debt-claim-template-v1';
  await db.documentPackageVersion.update({
    where: { version },
    data: { descriptionHash: null, description: null },
  });
  await db.documentTemplateVersion.update({
    where: { version: templateVersion },
    data: { descriptionHash: null },
  });
  const where = { templateVersion_tag: { templateVersion, tag: 'courtName' } };
  await db.documentTemplatePlaceholder.update({
    where,
    data: { field: 'courtAddress' },
  });
  const error = await publishPackages(db, [first]).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toContain('Catalog version differs');
  expect(
    (
      await db.documentTemplateVersion.findUniqueOrThrow({
        where: { version: templateVersion },
      })
    ).descriptionHash,
  ).toBeNull();
  await db.documentTemplatePlaceholder.update({
    where,
    data: { field: 'courtName' },
  });
  const legacyConflict = await publishPackages(db, [first], {
    adoptLegacy: false,
  }).catch((error: unknown) => error);
  expect(String(legacyConflict)).toContain('Catalog version differs');
  expect(await publishPackages(db, [first])).toEqual([
    { version, status: 'adopted' },
  ]);
  expect(await publishPackages(db, [first])).toEqual([
    { version, status: 'unchanged' },
  ]);
});

test('a compatible publication appears after restart and a rejected edit leaves the old snapshot usable', async () => {
  await publishRegisteredPackages(db);
  await registerDebtClaim(db);
  const baseline = await loadPublishedProcessingProfiles(db, false);
  expect(baseline.available().map(({ version }) => version)).toEqual([
    'bfl-bankruptcy-v14',
  ]);
  expect(baseline.has('test-debt-claim-v1')).toBe(false);
  expect(baseline.has('technical-document-v1')).toBe(true);
  expect(baseline.has('bfl-bankruptcy-v12')).toBe(true);
  expect(baseline.has('bfl-bankruptcy-v13')).toBe(true);

  const original = baseline.publications.find(
    ({ package: pack }) => pack.version === 'bfl-bankruptcy-v12',
  );
  if (!original?.analysis.instructions) throw new Error('Missing BFL v12');
  const description = structuredClone(original);
  const version = 'bfl-bankruptcy-v12-publication-fixture';
  description.scope = 'production';
  description.package.version = version;
  description.package.title = 'Опубликованный вариант заявления';
  description.analysis.instructions = {
    ...original.analysis.instructions,
    extraction: 'Проверь номер по титульной странице.',
  };
  const workspaceId = crypto.randomUUID();
  const api = createBackend(
    integrationConfig({ databaseUrl, redisUrl: 'redis://127.0.0.1:1' }),
    {
      logger: createLogger({
        service: 'api',
        environment: 'test',
        release: 'test',
        level: 'error',
      }),
      role: 'api',
      packageCatalog: 'published',
      dependencies: {
        storage: {
          exists: () => Promise.resolve(false),
          get: () => Promise.reject(new Error('Unexpected object read')),
          put: () => Promise.reject(new Error('Unexpected object write')),
          delete: () => Promise.reject(new Error('Unexpected object deletion')),
        },
      },
    },
  );
  try {
    expect(
      await publishCatalog(databaseUrl, {
        mode: 'description',
        input: description,
      }),
    ).toEqual([{ version, status: 'created' }]);
    expect(baseline.has(version)).toBe(false);
    const conflicting = structuredClone(description);
    conflicting.package.title = 'Отклонённое изменение';
    conflicting.package.documents.reverse();
    conflicting.analysis.instructions = {
      ...description.analysis.instructions,
      extraction: 'Сотри прежний номер.',
    };
    const conflict = await publishCatalog(databaseUrl, {
      mode: 'description',
      input: conflicting,
    }).catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(Error);
    expect(String(conflict)).toContain('Catalog version differs');

    await api.ready();
    expect(
      (await api.workHttp.views.packages()).map((pack) => pack.version),
    ).toEqual(['bfl-bankruptcy-v14', version]);
    await db.anykoWorkspace.create({
      data: { id: workspaceId, name: 'Publication fixture' },
    });
    const scope = memberScope(workspaceId);
    const workId = await api.workHttp.intake.createWork(scope, {
      title: 'Проверка опубликованной версии',
      packageVersion: version,
    });
    const view = await api.workHttp.views.get(scope, workId);
    expect(view.package.title).toBe('Опубликованный вариант заявления');
    expect(view.package.documents[0]?.version).toBe('bfl-statement-v11');

    const restarted = await loadPublishedProcessingProfiles(db, false);
    const pinned = restarted.resolve(version);
    expect(pinned.description.title).toBe('Опубликованный вариант заявления');
    expect(pinned.analysis.policy.extraction?.(pinned.analysis.fields)).toBe(
      'Проверь номер по титульной странице.',
    );
    const statement = pinned.description.documents[0];
    if (!statement) throw new Error('Missing published statement');
    expect(statement.version).toBe('bfl-statement-v11');
    expect(statement.blocks.length).toBeGreaterThan(0);
    const data = pinned.templateData(
      { lastName: 'Иванов' },
      statement,
      '2026-01-01',
    );
    expect(data.signerName).toBe('Иванов');
    expect(pinned.templateBytes(statement.version)).toEqual(
      baseline.resolve('bfl-bankruptcy-v12').templateBytes(statement.version),
    );
  } finally {
    await api.stop();
    await db.$transaction([
      db.work.deleteMany({ where: { workspaceId } }),
      db.anykoWorkspace.deleteMany({ where: { id: workspaceId } }),
      db.packageDocument.deleteMany({ where: { packageVersion: version } }),
      db.documentPackageVersion.deleteMany({ where: { version } }),
    ]);
  }
});
