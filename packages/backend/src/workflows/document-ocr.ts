import type { Logger } from '@anyko/logger';

import type {
  ArtifactRegistry,
  DocumentParser,
  SourceStorage,
} from '../modules/documents';
import {
  checksum,
  documentResultSchema,
  sourceFormatFromKey,
  StorageWriteOutcomeUnknown,
} from '../modules/documents';
import type { createProcessingService } from '../modules/processing';
export function createDocumentOcrWorkflow(options: {
  processing: ReturnType<typeof createProcessingService>;
  storage: SourceStorage;
  parser: DocumentParser;
  artifacts: ArtifactRegistry;
  logger: Logger;
  leaseMs: number;
}) {
  return async (
    input: { workspaceId: string; runId: string },
    signal: AbortSignal,
  ) => {
    signal.throwIfAborted();
    const claim = await options.processing.claim(
      input.runId,
      input.workspaceId,
      options.leaseMs,
    );
    if (!claim) return;
    const prefix = `results/${claim.workspaceId}/${claim.runId}/${claim.attemptToken}`;
    const resultKey = `${prefix}/result.json`;
    const written: string[] = [];
    try {
      const source = await options.storage.get(claim.sourceKey, signal);
      const format = sourceFormatFromKey(claim.sourceKey);
      if (!format) throw new Error('INVALID_SOURCE_FORMAT');
      options.logger.info({
        event: 'document_parse_started',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
      const parsed = await options.parser.parseDocument(
        source,
        format,
        claim.attemptToken,
      );
      signal.throwIfAborted();
      const images = [];
      let total = 0;
      for (const [position, image] of (parsed.images ?? []).entries()) {
        total += image.bytes.length;
        if (
          position >= 32 ||
          image.bytes.length > 3 * 1024 * 1024 ||
          total > 8 * 1024 * 1024
        )
          throw new Error('OCR_RESULT_TOO_LARGE');
        const key = `${prefix}/${image.path}`;
        const metadata = {
          path: image.path,
          key,
          contentType: image.contentType,
          size: image.bytes.length,
          checksum: await checksum(image.bytes),
        };
        documentResultSchema.parse({
          version: 2,
          markdown: parsed.markdown,
          processorVersion: parsed.processorVersion,
          images: [metadata],
        });
        await options.artifacts.stage({
          ...metadata,
          workspaceId: claim.workspaceId,
          documentId: claim.documentId,
          manifestKey: resultKey,
          kind: 'image',
          position,
        });
        written.push(key);
        signal.throwIfAborted();
        await options.storage.put(key, image.bytes, image.contentType, signal);
        images.push(metadata);
      }
      const result = documentResultSchema.parse({
        version: 2,
        markdown: parsed.markdown,
        processorVersion: parsed.processorVersion,
        images,
      });
      const bytes = new TextEncoder().encode(JSON.stringify(result));
      if (bytes.length > 5 * 1024 * 1024)
        throw new Error('OCR_RESULT_TOO_LARGE');
      await options.artifacts.stage({
        key: resultKey,
        workspaceId: claim.workspaceId,
        documentId: claim.documentId,
        manifestKey: resultKey,
        kind: 'result',
        contentType: 'application/json',
        size: bytes.length,
        checksum: await checksum(bytes),
      });
      written.push(resultKey);
      await options.processing.stageResult(resultKey, claim.workspaceId);
      signal.throwIfAborted();
      await options.storage.put(resultKey, bytes, 'application/json', signal);
      signal.throwIfAborted();
      const published = await options.processing.complete(
        claim,
        resultKey,
        result.processorVersion,
      );
      if (!published)
        for (const key of written) {
          await options.storage.delete(key);
          await options.artifacts.forget(key);
          await options.processing.forgetResult(key);
        }
      options.logger.info({
        event: published ? 'document_ocr_completed' : 'document_ocr_stale',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
    } catch (error) {
      options.logger.error({
        event: 'document_ocr_failed',
        jobId: claim.runId,
        correlationId: claim.correlationId,
        errorCode: 'OCR_FAILED',
      });
      if (error instanceof StorageWriteOutcomeUnknown) {
        try {
          await options.processing.fail(claim, 'OCR_FAILED');
        } catch {
          options.logger.warn({
            event: 'document_failure_status_pending',
            jobId: claim.runId,
          });
        }
        throw error;
      }
      await options.processing.fail(claim, 'OCR_FAILED');
    } finally {
      try {
        await options.parser.eraseAttempt(claim.attemptToken);
      } catch {
        options.logger.warn({
          event: 'processor_cleanup_pending',
          jobId: claim.runId,
        });
      }
    }
  };
}
