import { unzipSync } from 'fflate';
import { z } from 'zod';

import { documentImageLimit } from '../../../platform/document-output';
import type { DocumentResult } from '../application/ports';
import {
  hasPdfOcrProcessorVersion,
  pdfOcrSchema,
  pdfTableImagesSchema,
} from '../application/result-schema';
import {
  matchesSourceFormat,
  sourceContentTypes,
  type SourceFormat,
  sourceFormatFromKey,
} from '../application/source-format';

const processorErrors = new Map([
  ['TOO_MANY_EXPORTED_IMAGES', 'MINERU_TOO_MANY_IMAGES'],
  ['DOCUMENT_VISUALS_TOO_LARGE', 'MINERU_RESULT_TOO_LARGE'],
  ['EXPORT_TOO_LARGE', 'MINERU_RESULT_TOO_LARGE'],
  ['UNSUPPORTED_DOCUMENT_VISUAL', 'MINERU_UNSUPPORTED_EMBEDDED_IMAGE'],
  ['IMAGE_TOO_LARGE', 'MINERU_IMAGE_TOO_LARGE'],
  ['PDF_OCR_NO_READABLE_TEXT', 'MINERU_NO_READABLE_TEXT'],
]);
const archiveLimitErrors = new Set([
  'MINERU_TOO_MANY_IMAGES',
  'MINERU_RESULT_TOO_LARGE',
]);
const tableImagesEntry = 'pdf-table-images.json';
const tableImagesLimit = 128 * 1024;

function readTableImages(
  bytes: Uint8Array | undefined,
  images: NonNullable<DocumentResult['images']>,
): DocumentResult['tableImages'] {
  if (!bytes || bytes.length > tableImagesLimit) return;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = pdfTableImagesSchema.safeParse(JSON.parse(text));
    const paths = new Set(images.map(({ path }) => path));
    if (
      parsed.success &&
      parsed.data.every(({ imagePath }) => paths.has(imagePath))
    )
      return parsed.data;
  } catch {
    // Without verifiable metadata, vision still reads all table crops.
    return;
  }
}

function decodeArchive(
  archive: Uint8Array,
  processorVersion: string,
  format: SourceFormat,
): DocumentResult {
  let markdownBytes: Uint8Array | undefined;
  let pdfOcr: DocumentResult['pdfOcr'];
  let tableImages: DocumentResult['tableImages'];
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
        if (entry.name === 'markdown.md') {
          if (entry.originalSize > 4 * 1024 * 1024)
            throw new Error('MINERU_RESULT_TOO_LARGE');
          return true;
        }
        if (entry.name === 'pdf-ocr.json') {
          if (entry.originalSize > 2 * 1024 * 1024)
            throw new Error('MINERU_RESULT_TOO_LARGE');
          return true;
        }
        if (entry.name === tableImagesEntry)
          return format === 'pdf' && entry.originalSize <= tableImagesLimit;
        if (
          !/^images\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(entry.name)
        )
          return false;
        expandedSize += entry.originalSize;
        if (++imageCount > documentImageLimit)
          throw new Error('MINERU_TOO_MANY_IMAGES');
        if (
          entry.originalSize > 3 * 1024 * 1024 ||
          expandedSize > 8 * 1024 * 1024
        )
          throw new Error('MINERU_RESULT_TOO_LARGE');
        return true;
      },
    });
    markdownBytes = entries['markdown.md'];
    const evidence = entries['pdf-ocr.json'];
    if (evidence) {
      if (evidence.length > 2 * 1024 * 1024)
        throw new Error('MINERU_RESULT_TOO_LARGE');
      pdfOcr = pdfOcrSchema.parse(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(evidence)),
      );
    }
    let actualSize = 0;
    for (const [path, bytes] of Object.entries(entries)) {
      if (
        path === 'markdown.md' ||
        path === 'pdf-ocr.json' ||
        path === tableImagesEntry
      )
        continue;
      actualSize += bytes.length;
      if (bytes.length > 3 * 1024 * 1024 || actualSize > 8 * 1024 * 1024)
        throw new Error('MINERU_RESULT_TOO_LARGE');
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
    tableImages = readTableImages(entries[tableImagesEntry], images);
  } catch (error) {
    if (error instanceof Error && archiveLimitErrors.has(error.message))
      throw error;
    throw new Error('MINERU_INVALID_RESPONSE', { cause: error });
  }
  if (!markdownBytes || markdownBytes.byteLength > 4 * 1024 * 1024)
    throw new Error('MINERU_INVALID_RESPONSE');
  const markdown = new TextDecoder('utf-8', { fatal: true }).decode(
    markdownBytes,
  );
  return {
    markdown,
    processorVersion:
      pdfOcr && !hasPdfOcrProcessorVersion(processorVersion)
        ? processorVersion + '+eslav.1'
        : processorVersion,
    ...(pdfOcr && { pdfOcr }),
    ...(tableImages && { tableImages }),
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
      mode?: 'visual-inputs',
    ): Promise<DocumentResult> {
      if (bytes.length < 5 || bytes.length > 20 * 1024 * 1024)
        throw new Error('MINERU_INPUT_TOO_LARGE');
      const url = target(attemptId);
      if (mode === 'visual-inputs') url.pathname += '/visual-inputs';
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
          if (mode === 'visual-inputs' && response.status === 404)
            throw new Error('MINERU_VISUAL_INPUTS_OUTDATED');
          throw new Error(
            response.status === 409 || response.status === 410
              ? 'MINERU_CANCELLED'
              : (processorErrors.get(
                  response.headers.get('x-anyko-processor-error') ?? '',
                ) ?? 'MINERU_FAILED'),
          );
        }
        const version = response.headers.get('x-mineru-version');
        if (!version || !/^\d+\.\d+\.\d+(?:[\w.+-]*)$/.test(version)) {
          await response.body?.cancel();
          throw new Error('MINERU_INVALID_RESPONSE');
        }
        if (mode === 'visual-inputs' && !version.endsWith('+visual-inputs.1')) {
          await response.body?.cancel();
          throw new Error('MINERU_VISUAL_INPUTS_OUTDATED');
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
              throw new Error('MINERU_RESULT_TOO_LARGE');
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
        const result = decodeArchive(archive, 'mineru-' + version, format);
        if (format === 'pdf' && !result.pdfOcr)
          throw new Error('MINERU_PDF_OCR_OUTDATED');
        return result;
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
