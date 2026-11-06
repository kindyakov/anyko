import { GetBucketVersioningCommand, S3Client } from '@aws-sdk/client-s3';

import type { SourceStorage } from '../application/ports';
import { StorageWriteOutcomeUnknown } from '../application/ports';
export function createS3Storage(config: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  timeoutMs?: number;
}): SourceStorage {
  const client = new Bun.S3Client({
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region ?? 'us-east-1',
    virtualHostedStyle: false,
  });
  const timeout = config.timeoutMs ?? 15000;
  async function request(
    key: string,
    method: 'PUT' | 'GET' | 'DELETE',
    bytes?: Uint8Array,
    contentType?: string,
    signal?: AbortSignal,
  ) {
    const url = client.presign(key, { method, expiresIn: 60 });
    const response = await fetch(url, {
      method,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
      ...(bytes ? { body: Uint8Array.from(bytes) } : {}),
      ...(contentType ? { headers: { 'content-type': contentType } } : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('STORAGE_REQUEST_FAILED');
    }
    return response;
  }
  return {
    async ready() {
      const admin = new S3Client({
        endpoint: config.endpoint,
        region: config.region ?? 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      try {
        const result = await admin.send(
          new GetBucketVersioningCommand({ Bucket: config.bucket }),
          { abortSignal: AbortSignal.timeout(timeout) },
        );
        if (result.Status)
          throw new Error('VERSIONED_STORAGE_NOT_SUPPORTED_FOR_ERASURE');
      } finally {
        admin.destroy();
      }
    },
    async exists(key) {
      const response = await fetch(
        client.presign(key, { method: 'HEAD', expiresIn: 60 }),
        { method: 'HEAD', signal: AbortSignal.timeout(timeout) },
      );
      if (response.status === 404) return false;
      if (!response.ok) throw new Error('STORAGE_ERASURE_UNVERIFIED');
      return true;
    },
    async put(key, bytes, contentType, signal) {
      signal?.throwIfAborted();
      try {
        const response = await request(key, 'PUT', bytes, contentType, signal);
        await response.body?.cancel();
      } catch {
        throw new StorageWriteOutcomeUnknown();
      }
    },
    async get(key, signal) {
      const response = await request(key, 'GET', undefined, undefined, signal);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('STORAGE_BODY_MISSING');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 20 * 1024 * 1024)
            throw new Error('STORAGE_OBJECT_TOO_LARGE');
          chunks.push(next.value);
        }
      } catch (error) {
        await reader.cancel();
        throw error;
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return bytes;
    },
    async delete(key, signal) {
      const response = await request(
        key,
        'DELETE',
        undefined,
        undefined,
        signal,
      );
      await response.body?.cancel();
    },
  };
}
