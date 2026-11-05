import { unzipSync } from 'fflate';
import { z } from 'zod';
import {
  matchesSourceFormat,
  sourceContentTypes,
  sourceFormatFromKey,
  type SourceFormat,
} from '../application/source-format';
import type { DocumentResult } from '../application/ports';

function decodeArchive(
  archive: Uint8Array,
  processorVersion: string,
): DocumentResult {
  let markdownBytes: Uint8Array | undefined;
  const images: NonNullable<DocumentResult['images']> = [];
  try {
    let expandedSize = 0;
    let imageCount = 0;
    const names = new Set<string>();
    const entries = unzipSync(archive, {
      filter: (entry) => {
        if (names.has(entry.name) || names.size >= 2048)
          throw new Error('MINERU_INVALID_RESPONSE');
        names.add(entry.name);
        if (entry.name === 'markdown.md')
          return entry.originalSize <= 4 * 1024 * 1024;
        if (
          !/^images\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(entry.name)
        )
          return false;
        expandedSize += entry.originalSize;
        if (
          ++imageCount > 32 ||
          entry.originalSize > 3 * 1024 * 1024 ||
          expandedSize > 8 * 1024 * 1024
        )
          throw new Error('MINERU_INVALID_RESPONSE');
        return true;
      },
    });
    markdownBytes = entries['markdown.md'];
    let actualSize = 0;
    for (const [path, bytes] of Object.entries(entries)) {
      if (path === 'markdown.md') continue;
      actualSize += bytes.length;
      if (bytes.length > 3 * 1024 * 1024 || actualSize > 8 * 1024 * 1024)
        throw new Error('MINERU_INVALID_RESPONSE');
      const format = sourceFormatFromKey(path);
      if (
        !format ||
        !['jpg', 'png', 'webp'].includes(format) ||
        !matchesSourceFormat(bytes, format)
      )
        throw new Error('MINERU_INVALID_RESPONSE');
      images.push({
        path,
        contentType: sourceContentTypes[format],
        bytes,
      });
    }
  } catch {
    throw new Error('MINERU_INVALID_RESPONSE');
  }
  if (!markdownBytes || markdownBytes.byteLength > 4 * 1024 * 1024)
    throw new Error('MINERU_INVALID_RESPONSE');
  const markdown = new TextDecoder('utf-8', { fatal: true }).decode(
    markdownBytes,
  );
  return {
    markdown,
    processorVersion,
    images,
  };
}

export function createMineruParser(options: {
  baseUrl: string;
  timeoutMs: number;
}) {
  const base = new URL(
    options.baseUrl.endsWith('/') ? options.baseUrl : options.baseUrl + '/',
  );
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 1800000
  )
    throw new Error('INVALID_MINERU_CONFIGURATION');
  function target(attemptId: string) {
    if (!z.uuid().safeParse(attemptId).success)
      throw new Error('INVALID_ATTEMPT_ID');
    return new URL('v1/attempts/' + attemptId, base);
  }
  return {
    async parseDocument(
      bytes: Uint8Array,
      format: SourceFormat,
      attemptId: string,
    ): Promise<DocumentResult> {
      if (bytes.length < 5 || bytes.length > 20 * 1024 * 1024)
        throw new Error('MINERU_INPUT_TOO_LARGE');
      const url = target(attemptId);
      url.searchParams.set('format', format);
      const signal = AbortSignal.timeout(options.timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'PUT',
          body: Uint8Array.from(bytes),
          headers: { 'content-type': 'application/octet-stream' },
          signal,
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(
            response.status === 409 || response.status === 410
              ? 'MINERU_CANCELLED'
              : 'MINERU_FAILED',
          );
        }
        const version = response.headers.get('x-mineru-version');
        if (!version || !/^\d+\.\d+\.\d+(?:[\w.+-]*)$/.test(version)) {
          await response.body?.cancel();
          throw new Error('MINERU_INVALID_RESPONSE');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('MINERU_INVALID_RESPONSE');
        let size = 0;
        const chunks: Uint8Array[] = [];
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.length;
            if (size > 10 * 1024 * 1024)
              throw new Error('MINERU_INVALID_RESPONSE');
            chunks.push(next.value);
          }
        } catch (error) {
          await reader.cancel().catch(() => undefined);
          throw error;
        } finally {
          reader.releaseLock();
        }
        const archive = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          archive.set(chunk, offset);
          offset += chunk.length;
        }
        return decodeArchive(archive, 'mineru-' + version);
      } catch (error) {
        if (signal.aborted) throw new Error('MINERU_TIMEOUT', { cause: error });
        if (error instanceof Error && /^MINERU_[A-Z_]+$/.test(error.message))
          throw error;
        throw new Error('MINERU_UNAVAILABLE', { cause: error });
      }
    },
    async eraseAttempt(attemptId: string) {
      const response = await fetch(target(attemptId), {
        method: 'DELETE',
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      await response.body?.cancel();
      if (response.status !== 204) throw new Error('MINERU_ERASURE_PENDING');
    },
  };
}
