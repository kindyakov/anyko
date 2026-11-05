import { unzipSync } from 'fflate';
import { z } from 'zod';

const state = z.enum([
  'waiting-file',
  'pending',
  'running',
  'completed',
  'partial',
  'failed',
  'canceled',
]);
const file = z.object({
  file_id: z.string().min(1),
  status: state,
  upload: z
    .object({ url: z.url(), headers: z.record(z.string(), z.string()) })
    .optional(),
  result_url: z.url().optional(),
  parse: z.object({ parser_version: z.string().min(1) }).optional(),
});
const task = z.object({
  task_id: z.string().min(1),
  status: state,
  files: z.array(file).length(1),
});

class MineruError extends Error {
  constructor(
    public readonly code:
      | 'MINERU_UNAVAILABLE'
      | 'MINERU_INVALID_RESPONSE'
      | 'MINERU_FAILED'
      | 'MINERU_TIMEOUT'
      | 'MINERU_INPUT_TOO_LARGE',
  ) {
    super(code);
    this.name = 'MineruError';
  }
}

export interface ParsedPdf {
  markdown: string;
  processorVersion: string;
}

/** Self-hosted V1 Tasks adapter; never follows result URLs to another origin. */
export function createMineruParser(options: {
  baseUrl: string;
  timeoutMs: number;
  tier?: 'flash' | 'basic' | 'standard' | 'advanced';
  ocrMode?: 'auto' | 'txt' | 'ocr';
  pollIntervalMs?: number;
}) {
  const base = new URL(
    options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`,
  );
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('INVALID_MINERU_CONFIGURATION');
  if (
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 1800000
  )
    throw new Error('INVALID_MINERU_CONFIGURATION');
  const pollInterval = options.pollIntervalMs ?? 500;
  if (
    !Number.isSafeInteger(pollInterval) ||
    pollInterval < 1 ||
    pollInterval > 10000
  )
    throw new Error('INVALID_MINERU_CONFIGURATION');

  function localUrl(value: string) {
    const url = new URL(value, base);
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname.startsWith(base.pathname)
    )
      throw new MineruError('MINERU_INVALID_RESPONSE');
    return url;
  }

  async function readLimited(
    response: Response,
    limit: number,
  ): Promise<Uint8Array> {
    const declared = response.headers.get('content-length');
    if (declared && Number(declared) > limit) {
      await response.body?.cancel();
      throw new MineruError('MINERU_INVALID_RESPONSE');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new MineruError('MINERU_INVALID_RESPONSE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > limit) throw new MineruError('MINERU_INVALID_RESPONSE');
        chunks.push(next.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  return {
    async parsePdf(
      bytes: Uint8Array,
      externalSignal?: AbortSignal,
    ): Promise<ParsedPdf> {
      if (bytes.byteLength < 5 || bytes.byteLength > 20 * 1024 * 1024)
        throw new MineruError('MINERU_INPUT_TOO_LARGE');
      const deadline = AbortSignal.timeout(options.timeoutMs);
      const signal = externalSignal
        ? AbortSignal.any([deadline, externalSignal])
        : deadline;
      async function request(url: URL, init?: RequestInit) {
        const response = await fetch(url, {
          ...init,
          signal,
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new MineruError('MINERU_UNAVAILABLE');
        }
        return response;
      }
      async function json(response: Response) {
        try {
          return task.parse(
            JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(
                await readLimited(response, 1024 * 1024),
              ),
            ),
          );
        } catch (error) {
          if (signal.aborted) throw error;
          throw new MineruError('MINERU_INVALID_RESPONSE');
        }
      }
      try {
        const created = await json(
          await request(new URL('v1/tasks', base), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              files: [{ file_name: 'document.pdf', bytes: bytes.byteLength }],
              tier: options.tier ?? 'basic',
              ocr_mode: options.ocrMode ?? 'auto',
              output_formats: ['default'],
            }),
          }),
        );
        const initialFile = created.files[0];
        if (!initialFile) throw new MineruError('MINERU_INVALID_RESPONSE');
        if (initialFile.upload) {
          const headers = new Headers(initialFile.upload.headers);
          // Self-hosted uploads require no user credentials or cookie forwarding.
          if (
            headers.has('authorization') ||
            headers.has('cookie') ||
            headers.has('host')
          )
            throw new MineruError('MINERU_INVALID_RESPONSE');
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const uploaded = await request(localUrl(initialFile.upload.url), {
            method: 'PUT',
            headers,
            body: copy,
          });
          await uploaded.body?.cancel();
        }
        for (;;) {
          const snapshot = await json(
            await request(
              new URL(`v1/tasks/${encodeURIComponent(created.task_id)}`, base),
            ),
          );
          const current = snapshot.files[0];
          if (
            snapshot.task_id !== created.task_id ||
            current?.file_id !== initialFile.file_id
          )
            throw new MineruError('MINERU_INVALID_RESPONSE');
          if (current.status === 'completed') {
            if (!current.result_url || !current.parse)
              throw new MineruError('MINERU_INVALID_RESPONSE');
            const archive = await readLimited(
              await request(localUrl(current.result_url)),
              10 * 1024 * 1024,
            );
            let markdownBytes: Uint8Array | undefined;
            try {
              const entries = unzipSync(archive, {
                filter: (entry) =>
                  entry.name === 'markdown.md' &&
                  entry.originalSize <= 4 * 1024 * 1024,
              });
              markdownBytes = entries['markdown.md'];
            } catch {
              throw new MineruError('MINERU_INVALID_RESPONSE');
            }
            if (!markdownBytes || markdownBytes.byteLength > 4 * 1024 * 1024)
              throw new MineruError('MINERU_INVALID_RESPONSE');
            const markdown = new TextDecoder('utf-8', { fatal: true }).decode(
              markdownBytes,
            );
            return {
              markdown,
              processorVersion: `mineru-${current.parse.parser_version}`,
            };
          }
          if (['failed', 'canceled'].includes(current.status))
            throw new MineruError('MINERU_FAILED');
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => {
              clearTimeout(timer);
              reject(new MineruError('MINERU_TIMEOUT'));
            };
            const timer = setTimeout(() => {
              signal.removeEventListener('abort', onAbort);
              resolve();
            }, pollInterval);
            if (signal.aborted) {
              clearTimeout(timer);
              reject(new MineruError('MINERU_TIMEOUT'));
            } else signal.addEventListener('abort', onAbort, { once: true });
          });
        }
      } catch (error) {
        if (signal.aborted) throw new MineruError('MINERU_TIMEOUT');
        if (error instanceof MineruError) throw error;
        throw new MineruError('MINERU_UNAVAILABLE');
      }
    },
  };
}
