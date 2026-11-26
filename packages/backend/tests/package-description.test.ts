import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import { debtClaimProfile } from '../../../tests/integration/worker/support/debt-claim';
import { validatePackageDescription } from '../src/modules/templates';
import { createProcessingProfiles } from '../src/runtime/processing-profiles';

test('each retained BFL package resolves a canonical catalog description', () => {
  const profiles = createProcessingProfiles(true);
  for (const [version, statement] of [
    ['bfl-bankruptcy-v12', 'bfl-statement-v11'],
    ['bfl-bankruptcy-v13', 'bfl-statement-v11'],
    ['bfl-bankruptcy-v14', 'bfl-statement-v12'],
  ] as const) {
    const publication = profiles.publications.find(
      ({ package: pack }) => pack.version === version,
    );
    expect(publication?.profile).toEqual({
      id: 'bfl-bankruptcy',
      revision: '1',
    });
    expect(publication?.package.documents[0]?.version).toBe(statement);
    expect(publication?.package.documents[0]?.placeholders).toContainEqual({
      tag: 'lastName',
      field: 'lastName',
      placeholder: 'identity',
    });
    expect(
      publication?.requirements[statement]?.map(({ key }) => key),
    ).toContain('passport');
    expect(publication?.analysis.plan?.steps.at(-1)?.key).toBe(
      version === 'bfl-bankruptcy-v12' ? undefined : 'consistency',
    );
  }
});

test('every registered package validates with the actual supplied DOCX', () => {
  const profiles = createProcessingProfiles(true, [debtClaimProfile]);
  for (const description of profiles.publications) {
    const { templateBytes } = profiles.resolve(description.package.version);
    expect(validatePackageDescription(description, templateBytes)).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  }
});

test('a valid ZIP and checksum cannot disguise cross-row loop markers', () => {
  const profiles = createProcessingProfiles(true);
  const description = structuredClone(profiles.publications[0]);
  if (!description) throw new Error('Missing test package');
  const { templateBytes } = profiles.resolve(description.package.version);
  const inventory = description.package.documents.find(
    ({ id }) => id === 'inventory',
  );
  if (!inventory) throw new Error('Missing inventory');
  const zip = new PizZip(templateBytes(inventory.version));
  const xml = zip.file('word/document.xml')?.asText();
  if (!xml) throw new Error('Missing Word document');
  zip.file(
    'word/document.xml',
    xml.replace('{/land}', '').replace('{#houses}', '{/land}{#houses}'),
  );
  const bytes = zip.generate({ type: 'uint8array' });
  inventory.checksum = new Bun.CryptoHasher('sha256')
    .update(bytes)
    .digest('hex');
  expect(() =>
    validatePackageDescription(description, (version) =>
      version === inventory.version ? bytes : templateBytes(version),
    ),
  ).toThrow('Invalid DOCX loop');
});

test('publication rejects a duplicate field key and a date binding to an INN', () => {
  const profiles = createProcessingProfiles(false);
  const version = 'bfl-bankruptcy-v14';
  const description = profiles.publications.find(
    ({ package: pack }) => pack.version === version,
  );
  if (!description) throw new Error('Missing test package');
  const { templateBytes } = profiles.resolve(version);
  const collision = structuredClone(description);
  const field = collision.package.fields[0];
  if (!field) throw new Error('Missing field');
  collision.package.fields.push({ ...field, role: 'other-role' });
  expect(() => validatePackageDescription(collision, templateBytes)).toThrow(
    'Duplicate key',
  );

  const mistyped = structuredClone(description);
  const date = mistyped.package.documents[0]?.placeholders?.find(
    (binding) =>
      binding.field === 'documentDate' && binding.placeholder !== 'identity',
  );
  if (!date) throw new Error('Missing date binding');
  date.field = 'inn';
  expect(() => validatePackageDescription(mistyped, templateBytes)).toThrow(
    'Invalid DOCX binding',
  );
});

test('a changed file is rejected before tag inspection', () => {
  const profiles = createProcessingProfiles(false);
  const publication = profiles.publications[0];
  if (!publication) throw new Error('Missing test package');
  expect(() =>
    validatePackageDescription(publication, () => new Uint8Array([0])),
  ).toThrow('DOCX checksum mismatch');
});

test('a function approved for BFL cannot be selected by an unrelated profile', () => {
  const original = createProcessingProfiles(false).publications[0];
  if (!original) throw new Error('Missing test package');
  const description = structuredClone(original);
  description.package.version = 'test-unapproved-filling-v1';
  expect(() =>
    createProcessingProfiles(false, [
      {
        ...debtClaimProfile,
        packages: [description],
      },
    ]),
  ).toThrow('UNREGISTERED_FILLING_FUNCTION');
});
