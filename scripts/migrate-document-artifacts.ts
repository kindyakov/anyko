import { createDatabase, createResourceLocks } from '@anyko/database';
import { createS3Storage } from '@anyko/backend/runtime';
import {
  checksum,
  documentResultSchema,
  StorageWriteOutcomeUnknown,
} from '@anyko/backend/documents';
import { z } from 'zod';
const env = z
  .object({
    DATABASE_URL: z.string(),
    S3_ENDPOINT: z.string(),
    S3_BUCKET: z.string(),
    S3_ACCESS_KEY: z.string(),
    S3_SECRET_KEY: z.string(),
  })
  .parse(process.env);
if (
  !process.argv.includes('--applications-stopped') ||
  !process.argv.includes('--storage-requests-drained')
)
  throw new Error(
    'Migration requires verified quiescence; see document-vertical.md',
  );
const db = createDatabase(env.DATABASE_URL),
  locks = createResourceLocks(env.DATABASE_URL);
const storage = createS3Storage({
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
});
const legacy = z.object({
  markdown: z.string().max(4 * 1024 * 1024),
  processorVersion: z.string(),
  images: z
    .array(
      z.object({
        path: z
          .string()
          .regex(/^images\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i),
        contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
        base64: z.string().max(4 * 1024 * 1024),
      }),
    )
    .max(32)
    .default([]),
});
try {
  await storage.ready?.();
  for (const document of await db.sourceDocument.findMany({
    include: { runs: true },
  }))
    await locks.run(
      `document:${document.workspaceId}:${document.id}`,
      async () => {
        const operationId = crypto.randomUUID();
        await db.documentIo.create({
          data: {
            id: operationId,
            workspaceId: document.workspaceId,
            documentId: document.id,
          },
        });
        let uncertain = false;
        try {
          const source = {
            key: document.sourceKey,
            workspaceId: document.workspaceId,
            documentId: document.id,
            requestKey: document.requestKey,
            kind: 'source',
            contentType: 'application/octet-stream',
            size: document.size,
            checksum: document.sourceChecksum,
          };
          await db.documentArtifact.upsert({
            where: { key: source.key },
            create: source,
            update: {},
          });
          if (document.deletedAt) {
            await db.documentDeletion.upsert({
              where: { id: document.id },
              create: {
                id: document.id,
                workspaceId: document.workspaceId,
                requestKey: document.requestKey,
              },
              update: {},
            });
            return;
          }
          for (const run of document.runs) {
            if (!run.resultKey) continue;
            const oldKey = run.resultKey;
            const input: unknown = JSON.parse(
              new TextDecoder().decode(await storage.get(oldKey)),
            );
            if (documentResultSchema.safeParse(input).success) continue;
            const oldBytes = new TextEncoder().encode(JSON.stringify(input));
            await db.documentArtifact.upsert({
              where: { key: oldKey },
              create: {
                key: oldKey,
                workspaceId: document.workspaceId,
                documentId: document.id,
                manifestKey: oldKey,
                kind: 'result',
                contentType: 'application/json',
                size: oldBytes.length,
                checksum: await checksum(oldBytes),
              },
              update: {},
            });
            const previous = legacy.parse(input);
            const prefix = `results/${document.workspaceId}/${run.id}/migrated-v2`;
            const resultKey = `${prefix}/result.json`;
            const images = [];
            for (const [position, image] of previous.images.entries()) {
              const bytes = Uint8Array.from(
                Buffer.from(image.base64, 'base64'),
              );
              const asset = {
                key: `${prefix}/${image.path}`,
                workspaceId: document.workspaceId,
                documentId: document.id,
                manifestKey: resultKey,
                kind: 'image',
                position,
                path: image.path,
                contentType: image.contentType,
                size: bytes.length,
                checksum: await checksum(bytes),
              };
              await db.documentArtifact.upsert({
                where: { key: asset.key },
                create: asset,
                update: {},
              });
              await storage.put(asset.key, bytes, asset.contentType);
              images.push({
                path: image.path,
                key: asset.key,
                contentType: image.contentType,
                size: asset.size,
                checksum: asset.checksum,
              });
            }
            const result = documentResultSchema.parse({
              version: 2,
              markdown: previous.markdown,
              processorVersion: previous.processorVersion,
              images,
            });
            const bytes = new TextEncoder().encode(JSON.stringify(result));
            const asset = {
              key: resultKey,
              workspaceId: document.workspaceId,
              documentId: document.id,
              manifestKey: resultKey,
              kind: 'result',
              contentType: 'application/json',
              size: bytes.length,
              checksum: await checksum(bytes),
            };
            await db.documentArtifact.upsert({
              where: { key: resultKey },
              create: asset,
              update: {},
            });
            await storage.put(resultKey, bytes, 'application/json');
            await db.processingRun.update({
              where: { id: run.id },
              data: { resultKey },
            });
            await storage.delete(oldKey);
            if (await storage.exists(oldKey))
              throw new Error('LEGACY_RESULT_ERASURE_UNCONFIRMED');
            await db.documentArtifact.deleteMany({ where: { key: oldKey } });
          }
        } catch (error) {
          uncertain = error instanceof StorageWriteOutcomeUnknown;
          throw error;
        } finally {
          if (uncertain)
            await db.documentIo.update({
              where: { id: operationId },
              data: { uncertain: true },
            });
          else await db.documentIo.deleteMany({ where: { id: operationId } });
        }
      },
    );
  // Legacy staging is cleaned only while applications are stopped during cutover.
  const published = new Set(
    (
      await db.processingRun.findMany({
        where: { resultKey: { not: null } },
        select: { resultKey: true },
      })
    ).flatMap((row) => (row.resultKey ? [row.resultKey] : [])),
  );
  for (const asset of await db.documentArtifact.findMany({
    where: { kind: { in: ['result', 'image'] } },
  })) {
    if (!published.has(asset.manifestKey ?? asset.key)) {
      await storage.delete(asset.key);
      if (await storage.exists(asset.key))
        throw new Error('LEGACY_RESULT_ERASURE_UNCONFIRMED');
      await db.documentArtifact.delete({ where: { key: asset.key } });
    }
  }
  for (const row of await db.sourceUpload.findMany()) {
    if (!(await db.sourceDocument.count({ where: { sourceKey: row.key } }))) {
      await storage.delete(row.key);
      await db.documentArtifact.deleteMany({ where: { key: row.key } });
    }
    await db.sourceUpload.deleteMany({ where: { key: row.key } });
  }
  for (const row of await db.resultUpload.findMany()) {
    if (!(await db.processingRun.count({ where: { resultKey: row.key } })))
      await storage.delete(row.key);
    await db.resultUpload.deleteMany({ where: { key: row.key } });
  }
  console.info('Document artifacts migrated to separate private S3 objects');
} finally {
  await locks.stop();
  await db.$disconnect();
}
