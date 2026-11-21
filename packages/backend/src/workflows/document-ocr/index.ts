import { LlmError } from '@anyko/llm';
import { diagnoseFailure, type Logger } from '@anyko/logger';

import type { DocumentAgents } from '../../modules/agents';
import type { ConnectionsModule } from '../../modules/connections';
import type {
  ArtifactRegistry,
  DocumentParser,
  DocumentResult,
  SourceStorage,
} from '../../modules/documents';
import {
  checksum,
  cloudImageOcrVersion,
  documentResultSchema,
  sourceFormatFromKey,
  StorageWriteOutcomeUnknown,
} from '../../modules/documents';
import type {
  DocumentArtifacts,
  DocumentAttempt,
} from '../../modules/processing';
import { documentImageLimit } from '../../platform/document-output';

const visionFrameConcurrency = 4;

const failureCodes = new Map([
  ['MINERU_PDF_OCR_OUTDATED', 'OCR_PROCESSOR_OUTDATED'],
  ['MINERU_VISUAL_INPUTS_OUTDATED', 'OCR_PROCESSOR_OUTDATED'],
  ['MINERU_TOO_MANY_IMAGES', 'OCR_TOO_MANY_IMAGES'],
  ['MINERU_RESULT_TOO_LARGE', 'OCR_RESULT_TOO_LARGE'],
  ['OCR_RESULT_TOO_LARGE', 'OCR_RESULT_TOO_LARGE'],
  ['OCR_TOO_MANY_IMAGES', 'OCR_TOO_MANY_IMAGES'],
  ['MINERU_UNSUPPORTED_EMBEDDED_IMAGE', 'OCR_UNSUPPORTED_EMBEDDED_IMAGE'],
  ['MINERU_IMAGE_TOO_LARGE', 'OCR_IMAGE_TOO_LARGE'],
  ['MINERU_NO_READABLE_TEXT', 'OCR_NO_READABLE_TEXT'],
  ['MINERU_TIMEOUT', 'OCR_TIMEOUT'],
  ['MINERU_UNAVAILABLE', 'OCR_PROCESSOR_UNAVAILABLE'],
  ['MINERU_INVALID_RESPONSE', 'OCR_INVALID_RESULT'],
  ['LLM_NOT_CONFIGURED', 'OCR_VISION_NOT_CONFIGURED'],
  ['CONNECTION_REVOKED', 'OCR_VISION_NOT_CONFIGURED'],
  ['LLM_AUTH_FAILED', 'OCR_VISION_NOT_CONFIGURED'],
  ['LLM_TIMEOUT', 'OCR_TIMEOUT'],
  ['LLM_UNAVAILABLE', 'OCR_PROCESSOR_UNAVAILABLE'],
  ['LLM_RATE_LIMITED', 'OCR_VISION_RATE_LIMITED'],
  ['LLM_INVALID_RESPONSE', 'OCR_INVALID_RESULT'],
  ['OCR_NO_READABLE_TEXT', 'OCR_NO_READABLE_TEXT'],
]);
export function createDocumentOcrWorkflow(options: {
  processing: Pick<DocumentArtifacts, 'stageResult' | 'forgetResult'>;
  claimAttempt(
    workspaceId: string,
    runId: string,
  ): Promise<DocumentAttempt | null>;
  storage: SourceStorage;
  parser: DocumentParser;
  vision: Pick<DocumentAgents, 'describe'>;
  connection: ConnectionsModule['internal']['connection'];
  artifacts: ArtifactRegistry;
  logger: Logger;
}) {
  return async (
    input: { workspaceId: string; runId: string },
    signal: AbortSignal,
  ) => {
    signal.throwIfAborted();
    const attempt = await options.claimAttempt(input.workspaceId, input.runId);
    if (!attempt) return;
    const { attemptId, run } = attempt;
    const prefix = `results/${run.workspaceId}/${run.id}/${attemptId}`;
    const resultKey = `${prefix}/result.json`;
    const written: string[] = [];
    try {
      const source = await options.storage.get(run.sourceKey, signal);
      const format = sourceFormatFromKey(run.sourceKey);
      if (!format) throw new Error('INVALID_SOURCE_FORMAT');
      options.logger.info({
        event: 'document_parse_started',
        jobId: run.id,
        correlationId: run.correlationId,
      });
      const raster = format !== 'pdf' && format !== 'docx';
      let parsed: DocumentResult;
      if (raster) {
        const config = await options.connection(run.workspaceId, null);
        const inputs = await options.parser.parseDocument(
          source,
          format,
          attemptId,
          'visual-inputs',
        );
        const frames = inputs.images ?? [];
        const pages = [];
        const assertCurrent = async () => {
          signal.throwIfAborted();
          await options.connection(run.workspaceId, config.revision);
        };
        for (
          let offset = 0;
          offset < frames.length;
          offset += visionFrameConcurrency
        ) {
          const batch = frames.slice(offset, offset + visionFrameConcurrency);
          // Drain the current batch before publishing or failing the attempt.
          const results = await Promise.allSettled(
            batch.map(async (image) => {
              await assertCurrent();
              return options.vision.describe({
                assertCurrent,
                connection: config.connection,
                disableReasoning: config.visionDisableReasoning,
                trace: {
                  correlationId: run.correlationId,
                  jobId: run.id,
                  stage: 'ocr',
                  documentId: run.documentId,
                },
                modelId: config.visionModel,
                resource: `${run.workspaceId}:${run.documentId}`,
                threadId: attemptId,
                bytes: image.bytes,
                mediaType: image.contentType,
                purpose: 'transcription',
                signal,
              });
            }),
          );
          for (const result of results) {
            if (result.status === 'rejected') throw result.reason;
            pages.push(result.value.description.trim());
          }
        }
        await assertCurrent();
        if (!pages.some(Boolean)) throw new Error('OCR_NO_READABLE_TEXT');
        parsed = {
          markdown:
            pages.length === 1
              ? pages.join('')
              : pages
                  .map(
                    (page, index) =>
                      `## Страница ${String(index + 1)}\n\n${page}`,
                  )
                  .join('\n\n'),
          processorVersion: cloudImageOcrVersion,
          images: frames,
        };
      } else {
        parsed = await options.parser.parseDocument(source, format, attemptId);
      }
      signal.throwIfAborted();
      const images = [];
      let total = 0;
      for (const [position, image] of (parsed.images ?? []).entries()) {
        total += image.bytes.length;
        if (position >= documentImageLimit)
          throw new Error('OCR_TOO_MANY_IMAGES');
        if (image.bytes.length > 3 * 1024 * 1024 || total > 8 * 1024 * 1024)
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
          workspaceId: run.workspaceId,
          documentId: run.documentId,
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
        pdfOcr: parsed.pdfOcr,
        images,
      });
      const bytes = new TextEncoder().encode(JSON.stringify(result));
      if (bytes.length > 5 * 1024 * 1024)
        throw new Error('OCR_RESULT_TOO_LARGE');
      await options.artifacts.stage({
        key: resultKey,
        workspaceId: run.workspaceId,
        documentId: run.documentId,
        manifestKey: resultKey,
        kind: 'result',
        contentType: 'application/json',
        size: bytes.length,
        checksum: await checksum(bytes),
      });
      written.push(resultKey);
      await options.processing.stageResult(resultKey, run.workspaceId);
      signal.throwIfAborted();
      await options.storage.put(resultKey, bytes, 'application/json', signal);
      signal.throwIfAborted();
      const published = await attempt.finish({
        status: 'succeeded',
        resultKey,
        processorVersion: result.processorVersion,
      });
      if (!published)
        for (const key of written) {
          await options.storage.delete(key);
          await options.artifacts.forget(key);
          await options.processing.forgetResult(key);
        }
      options.logger.info({
        event: published ? 'document_ocr_completed' : 'document_ocr_stale',
        jobId: run.id,
        correlationId: run.correlationId,
      });
    } catch (error) {
      const originalCode =
        error instanceof Error && failureCodes.has(error.message)
          ? error.message
          : undefined;
      const errorCode =
        (originalCode ? failureCodes.get(originalCode) : undefined) ??
        'OCR_FAILED';
      const failure = diagnoseFailure(error, {
        code: errorCode,
        message:
          error instanceof LlmError
            ? error.diagnosticMessage
            : 'Не удалось обработать исходник при распознавании.',
        operation: 'document.ocr',
        ...(originalCode &&
          originalCode !== errorCode && { causeCode: originalCode }),
      });
      options.logger.error({
        event: 'document_ocr_failed',
        jobId: run.id,
        jobType: 'document.ocr',
        attempt: run.attempts,
        correlationId: run.correlationId,
        errorCode: failure.code,
        failure,
      });
      if (error instanceof StorageWriteOutcomeUnknown) {
        try {
          await attempt.finish({ status: 'failed', errorCode });
        } catch {
          options.logger.warn({
            event: 'document_failure_status_pending',
            jobId: run.id,
          });
        }
        throw error;
      }
      await attempt.finish({ status: 'failed', errorCode });
    } finally {
      try {
        await options.parser.eraseAttempt(attemptId);
      } catch {
        options.logger.warn({
          event: 'processor_cleanup_pending',
          jobId: run.id,
        });
      }
    }
  };
}
