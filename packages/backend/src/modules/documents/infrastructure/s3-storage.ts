import type { SourceStorage } from '../application/ports';
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
  ) {
    const url = client.presign(key, { method, expiresIn: 60 });
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeout),
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
    async put(key, bytes, contentType) {
      const response = await request(key, 'PUT', bytes, contentType);
      await response.body?.cancel();
    },
    async get(key) {
      const response = await request(key, 'GET');
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
    async delete(key) {
      const response = await request(key, 'DELETE');
      await response.body?.cancel();
    },
  };
}
