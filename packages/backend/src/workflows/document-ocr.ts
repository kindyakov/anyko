import type { DocumentParser, SourceStorage } from '../modules/documents';
import type { createProcessingService } from '../modules/processing';
import type { Logger } from '@anyko/logger';
import { documentResultSchema } from '../modules/documents';

const failureCodes = new Set([
  'MINERU_UNAVAILABLE',
  'MINERU_INVALID_RESPONSE',
  'MINERU_FAILED',
  'MINERU_TIMEOUT',
  'MINERU_INPUT_TOO_LARGE',
  'STORAGE_REQUEST_FAILED',
  'STORAGE_OBJECT_TOO_LARGE',
  'STORAGE_BODY_MISSING',
  'OCR_RESULT_TOO_LARGE',
]);

export function createDocumentOcrWorkflow(options: {
  processing: ReturnType<typeof createProcessingService>;
  storage: SourceStorage;
  parser: DocumentParser;
  logger: Logger;
  leaseMs: number;
}) {
  return async (input: { workspaceId: string; runId: string }) => {
    const claim = await options.processing.claim(
      input.runId,
      input.workspaceId,
      options.leaseMs,
    );
    if (!claim) return;
    const resultKey = `results/${claim.workspaceId}/${claim.runId}/${claim.attemptToken}.json`;
    let phase: 'source' | 'parse' | 'result' | 'publish' = 'source';
    try {
      options.logger.info({
        event: 'document_source_loading',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
      const source = await options.storage.get(claim.sourceKey);
      phase = 'parse';
      options.logger.info({
        event: 'document_parse_started',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
      const result = documentResultSchema.parse(
        await options.parser.parsePdf(source),
      );
      options.logger.info({
        event: 'document_parse_completed',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
      const bytes = new TextEncoder().encode(JSON.stringify(result));
      if (bytes.length > 5 * 1024 * 1024)
        throw new Error('OCR_RESULT_TOO_LARGE');
      await options.processing.stageResult(resultKey, claim.workspaceId);
      phase = 'result';
      await options.storage.put(resultKey, bytes, 'application/json');
      phase = 'publish';
      const published = await options.processing.complete(
        claim,
        resultKey,
        result.processorVersion,
      );
      options.logger.info({
        event: published ? 'document_ocr_completed' : 'document_ocr_stale',
        jobId: claim.runId,
        correlationId: claim.correlationId,
      });
    } catch (error) {
      const errorCode =
        error instanceof Error && failureCodes.has(error.message)
          ? error.message
          : phase === 'source'
            ? 'SOURCE_READ_FAILED'
            : phase === 'result'
              ? 'RESULT_WRITE_FAILED'
              : phase === 'publish'
                ? 'RESULT_PUBLICATION_FAILED'
                : 'OCR_FAILED';
      options.logger.error({
        event: 'document_ocr_failed',
        jobId: claim.runId,
        correlationId: claim.correlationId,
        errorCode,
      });
      await options.processing.fail(claim, errorCode);
    }
  };
}
