import { LlmError } from '@anyko/llm';

import type { WorkFacts } from '../../modules/agents';
import { DocumentError } from '../../modules/documents';
import { stepOutputSchema, type WorkAttempt } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import { isAppError } from '../../platform/errors';
import type { WorkDependencies } from '../work-dependencies';
import { createRunState } from '../work-execution/run-state';

import {
  type ContinuationSource,
  createWorkContinuation,
} from './continue-session';
import { locateEvidence } from './locate-evidence';
import { addUsage, callModel } from './model-call';

const delay = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 500);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });

// Анализ работы: разбор документов, описание изображений, извлечение кандидатов и сверка сессии.
// Каждый шаг пишется в запуск; вызовы модели выполняются вне UnitOfWork.
export function createWorkAnalysis(deps: WorkDependencies) {
  const continueSession = createWorkContinuation(deps);
  return async (
    attempt: WorkAttempt,
    signal: AbortSignal,
    loadConnection: (
      revision: number | null,
    ) => ReturnType<WorkDependencies['connections']['internal']['connection']>,
  ) => {
    const { run } = attempt;
    const { current, step } = createRunState(deps, attempt);
    const parse = async (documentId: string) => {
      await step({ stage: 'parsing', documentId, status: 'running' });
      let doc = await deps.documents.internal.queries.get({
        workspaceId: run.workspaceId,
        documentId,
      });
      if (doc.status === 'failed')
        doc = await deps.documents.internal.commands.retry({
          workspaceId: run.workspaceId,
          documentId,
          actorId: 'work-pipeline',
          correlationId: run.correlationId,
        });
      while (doc.status === 'queued' || doc.status === 'running') {
        signal.throwIfAborted();
        await current();
        await delay(signal);
        doc = await deps.documents.internal.queries.get({
          workspaceId: run.workspaceId,
          documentId,
        });
      }
      if (doc.status !== 'succeeded') throw new Error('PARSING_FAILED');
      await step({ stage: 'parsing', documentId, status: 'succeeded' });
      return deps.documents.internal.queries.analysis({
        workspaceId: run.workspaceId,
        documentId,
      });
    };
    const { revision } = await loadConnection(run.settingsRevision);
    const readConnection = () => loadConnection(revision);
    const assertCurrent = async () => {
      await current();
      await readConnection();
    };
    const pack = requirePackage((await current()).packageVersion);
    const candidates: WorkFacts['candidates'] = [];
    const sources: ContinuationSource[] = [];
    let failures = 0,
      completed = 0;
    for (const documentId of run.documentIds) {
      let stage: 'parsing' | 'vision' | 'extraction' = 'parsing';
      try {
        signal.throwIfAborted();
        await current();
        const source = await parse(documentId);
        stage = 'vision';
        let output = await attempt.cached(
          documentId,
          'vision',
          source.sourceDigest,
        );
        if (!output) {
          await step({ stage, documentId, status: 'running' });
          const visuals = [];
          let usage: {
            inputTokens: number | null;
            outputTokens: number | null;
          } = { inputTokens: 0, outputTokens: 0 };
          // Normalized originals are authoritative for photos/DOCX; avoid describing their OCR crops twice.
          const normalized = source.images.filter((image) =>
            image.path.includes('/anyko-'),
          );
          for (const image of normalized.length ? normalized : source.images) {
            signal.throwIfAborted();
            await current();
            const stepConnection = await readConnection();
            const callId = deps.newId();
            const result = await callModel({
              logger: deps.logger,
              callId,
              runId: run.id,
              correlationId: run.correlationId,
              stage,
              provider: stepConnection.connection.id,
              model: stepConnection.visionModel,
              execute: () =>
                deps.agents.model.describe({
                  assertCurrent,
                  connection: stepConnection.connection,
                  modelId: stepConnection.visionModel,
                  resource: `${run.workspaceId}:${run.workId}`,
                  threadId: callId,
                  bytes: image.bytes,
                  mediaType: image.contentType,
                  signal,
                }),
            });
            usage = addUsage(usage, result.usage);
            visuals.push({
              path: image.path,
              description: result.description,
              imageIndex: source.images.findIndex(
                (item) => item.path === image.path,
              ),
            });
            await step({ stage, documentId, status: 'running', usage });
          }
          output = {
            version: 1,
            sourceDigest: source.sourceDigest,
            visuals,
            candidates: [],
          };
          await step({
            stage,
            documentId,
            status: visuals.length ? 'succeeded' : 'skipped',
            output,
            ...(visuals.length ? { usage } : {}),
          });
        }
        stage = 'extraction';
        let extracted = await attempt.cached(
          documentId,
          stage,
          source.sourceDigest,
        );
        if (!extracted) {
          await step({ stage, documentId, status: 'running' });
          const found: WorkFacts['candidates'] = [];
          let usage: {
            inputTokens: number | null;
            outputTokens: number | null;
          } = { inputTokens: 0, outputTokens: 0 };
          for (
            let offset = 0;
            offset < Math.max(1, source.text.length);
            offset += 62000
          ) {
            signal.throwIfAborted();
            await current();
            const stepConnection = await readConnection();
            const threadId = deps.newId();
            await deps.processing.internal.thread(
              run.workspaceId,
              run.workId,
              threadId,
            );
            const result = await callModel({
              logger: deps.logger,
              callId: threadId,
              runId: run.id,
              correlationId: run.correlationId,
              stage,
              provider: stepConnection.connection.id,
              model: stepConnection.extractionModel,
              execute: () =>
                deps.agents.model.extract({
                  assertCurrent,
                  connection: stepConnection.connection,
                  modelId: stepConnection.extractionModel,
                  fields: pack.fields,
                  threadId,
                  resource: `${run.workspaceId}:${run.workId}`,
                  document: {
                    id: documentId,
                    text: source.text.slice(offset, offset + 64000),
                    visuals: offset === 0 ? output.visuals : [],
                  },
                  signal,
                }),
            });
            found.push(...result.candidates);
            usage = addUsage(usage, result.usage);
            await step({ stage, documentId, status: 'running', usage });
          }
          extracted = stepOutputSchema.parse({
            version: 1,
            sourceDigest: source.sourceDigest,
            visuals: output.visuals,
            candidates: found,
          });
          await step({
            stage,
            documentId,
            status: 'succeeded',
            output: extracted,
            usage,
          });
        }
        sources.push({
          id: documentId,
          filename:
            (
              await deps.works.internal.documents(run.workspaceId, run.workId)
            ).find((d) => d.id === documentId)?.filename ?? documentId,
          digest: source.sourceDigest,
          text: source.text,
          ...(source.pdfOcr && { pdfOcr: source.pdfOcr }),
          visuals: output.visuals,
        });
        candidates.push(
          ...locateEvidence(extracted.candidates, [
            { id: documentId, ...source },
          ]),
        );
        completed++;
      } catch (error) {
        if (isAppError(error) && error.code === 'CONNECTION_REVOKED')
          throw error;
        await readConnection();
        if (
          signal.aborted ||
          (error instanceof DocumentError && error.code === 'NOT_FOUND')
        )
          throw error;
        await current();
        failures++;
        await step({
          stage,
          documentId,
          status: 'failed',
          errorCode:
            error instanceof LlmError
              ? error.code
              : `${stage.toUpperCase()}_FAILED`,
        });
      }
    }
    await continueSession({
      attempt,
      settingsRevision: revision,
      readConnection,
      fields: pack.fields,
      candidates,
      sources,
      failures,
      completed,
      signal,
      current,
    });
  };
}
