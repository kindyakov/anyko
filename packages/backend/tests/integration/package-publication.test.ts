import { afterAll, afterEach, expect, test } from 'bun:test';

import { createDatabase, createDatabasePool } from '@anyko/database';

import {
  debtClaimProfile,
  registerDebtClaim,
  unregisterDebtClaim,
} from '../../../../tests/integration/worker/support/debt-claim';
import { publishPackages } from '../../src/modules/templates/infrastructure/publish-packages';
import { createProcessingProfiles } from '../../src/runtime/processing-profiles';

const url = process.env.TEST_DATABASE_URL;
if (!url || !/^\/anyko_test(?:_[a-z0-9_]+)?$/u.test(new URL(url).pathname))
  throw new Error('Dedicated TEST_DATABASE_URL is required');
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
  expect(await publishPackages(db, [first])).toEqual([
    { version, status: 'adopted' },
  ]);
  expect(await publishPackages(db, [first])).toEqual([
    { version, status: 'unchanged' },
  ]);
});
