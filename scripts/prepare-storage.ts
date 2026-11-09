import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
const parsed = z
  .object({
    S3_ENDPOINT: z.url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error('STORAGE_CONFIGURATION_INVALID');
  process.exitCode = 1;
} else {
  const c = parsed.data;
  const client = new S3Client({
    endpoint: c.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: c.S3_ACCESS_KEY,
      secretAccessKey: c.S3_SECRET_KEY,
    },
    maxAttempts: 2,
  });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: c.S3_BUCKET }), {
        abortSignal: AbortSignal.timeout(10000),
      });
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: c.S3_BUCKET }), {
        abortSignal: AbortSignal.timeout(10000),
      });
    }
    console.info('Local S3 bucket ready');
  } catch {
    console.error('STORAGE_PREPARATION_FAILED');
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}
