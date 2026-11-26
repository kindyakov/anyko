import { createHash } from 'node:crypto';

import { strToU8, zipSync } from 'fflate';

import type { Database } from '@anyko/database';

import type { ProcessingProfile } from '../../../../packages/backend/src/runtime/processing-profiles';
import { publishRegisteredPackages } from '../../../../packages/backend/src/runtime/publish-packages';

const title = 'Иск о взыскании долга (тестовый профиль)';
const packages: ProcessingProfile['packages'][number][] = [];
const assets = new Map<string, Uint8Array>();

for (const [suffix, parties] of [
  ['v1', [['plaintiffInn', 'ИНН истца']]],
  [
    'v2',
    [
      ['plaintiffInn', 'ИНН истца'],
      ['defendantInn', 'ИНН ответчика'],
    ],
  ],
] as const) {
  const version = `test-debt-claim-${suffix}`;
  const fields = [
    ['courtName', 'Наименование суда'],
    ['courtAddress', 'Адрес суда'],
    ...parties,
  ] as const;
  const xml = fields
    .map(
      ([key, label]) => `<w:p><w:r><w:t>${label}: {${key}}</w:t></w:r></w:p>`,
    )
    .join('');
  const templateVersion = `test-debt-claim-template-${suffix}`;
  const bytes = zipSync(
    {
      '[Content_Types].xml': strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml}</w:body></w:document>`,
      ),
    },
    { mtime: new Date('2026-01-01T00:00:00Z') },
  );
  assets.set(templateVersion, bytes);
  packages.push({
    analysis: { excludedFields: [] },
    requirements: {},
    package: {
      id: 'test-debt-claim',
      version,
      title,
      technical: true,
      fields: fields.map(([key, label]) => ({
        key,
        label,
        ...(key.endsWith('Inn') && {
          valueType: 'inn' as const,
          role: key === 'plaintiffInn' ? 'plaintiff' : 'defendant',
        }),
        kind: 'text',
        multiline: false,
        limits: { maxLength: 200 },
        columns: [],
      })),
      documents: [
        {
          id: 'test-debt-claim-template',
          version: templateVersion,
          title,
          filename: 'claim.docx',
          checksum: createHash('sha256').update(bytes).digest('hex'),
          blocks: [],
          placeholders: fields.map(([field]) => ({
            tag: field,
            field,
            placeholder: 'identity',
          })),
        },
      ],
    },
  });
}

export const debtClaimProfile: ProcessingProfile = {
  id: 'test-debt-claim',
  revision: '1',
  packages,
  templateBytes(version) {
    const bytes = assets.get(version);
    if (!bytes) throw new Error('UNKNOWN_FIXTURE_TEMPLATE');
    return bytes;
  },
};

export async function registerDebtClaim(db: Database) {
  return publishRegisteredPackages(db, [debtClaimProfile], debtClaimProfile.id);
}

export async function unregisterDebtClaim(db: Database) {
  const versions = packages.map(({ package: { version } }) => version);
  await db.$transaction(async (tx) => {
    await tx.packageDocument.deleteMany({
      where: { packageVersion: { in: versions } },
    });
    await tx.documentPackageVersion.deleteMany({
      where: { version: { in: versions } },
    });
    await tx.documentTemplateVersion.deleteMany({
      where: { version: { in: [...assets.keys()] } },
    });
  });
}
