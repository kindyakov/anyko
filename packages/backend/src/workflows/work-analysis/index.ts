import { LlmError } from '@anyko/llm';

import type { WorkFacts } from '../../modules/agents';
import { DocumentError } from '../../modules/documents';
import { stepOutputSchema, type WorkRunRecord } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import type { WorkDependencies } from '../work-dependencies';
import { createRunState, type RunState } from '../work-execution/run-state';

import {
  type ContinuationSource,
  createWorkContinuation,
} from './continue-session';
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
  const state: RunState = createRunState(deps);
  const current = (run: WorkRunRecord) => state.current(run);
  const step: RunState['step'] = (run, input) => state.step(run, input);
  const continueSession = createWorkContinuation(deps);
  const parse = async (
    run: WorkRunRecord,
    documentId: string,
    signal: AbortSignal,
  ) => {
    await step(run, { stage: 'parsing', documentId, status: 'running' });
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
      await current(run);
      await delay(signal);
      doc = await deps.documents.internal.queries.get({
        workspaceId: run.workspaceId,
        documentId,
      });
    }
    if (doc.status !== 'succeeded') throw new Error('PARSING_FAILED');
    await step(run, { stage: 'parsing', documentId, status: 'succeeded' });
    return deps.documents.internal.queries.analysis({
      workspaceId: run.workspaceId,
      documentId,
    });
  };
  return async (run: WorkRunRecord, signal: AbortSignal) => {
    if (run.settingsRevision === null) throw new Error('LLM_NOT_CONFIGURED');
    const config = await deps.processing.internal.connection(
      run.workspaceId,
      run.settingsRevision,
    );
    const pack = requirePackage((await current(run)).packageVersion);
    const candidates: WorkFacts['candidates'] = [];
    const sources: ContinuationSource[] = [];
    let failures = 0,
      completed = 0;
    for (const documentId of run.documentIds) {
      let stage: 'parsing' | 'vision' | 'extraction' = 'parsing';
      try {
        signal.throwIfAborted();
        await current(run);
        const source = await parse(run, documentId, signal);
        stage = 'vision';
        let output = await deps.processing.internal.cached(
          run,
          documentId,
          'vision',
          source.sourceDigest,
        );
        if (!output) {
          await step(run, { stage, documentId, status: 'running' });
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
            await current(run);
            const callId = deps.newId();
            const result = await callModel({
              logger: deps.logger,
              callId,
              runId: run.id,
              correlationId: run.correlationId,
              stage,
              provider: config.connection.id,
              model: config.visionModel,
              execute: () =>
                deps.agents.model.describe({
                  connection: config.connection,
                  modelId: config.visionModel,
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
            await step(run, { stage, documentId, status: 'running', usage });
          }
          output = {
            version: 1,
            sourceDigest: source.sourceDigest,
            visuals,
            candidates: [],
          };
          await step(run, {
            stage,
            documentId,
            status: visuals.length ? 'succeeded' : 'skipped',
            output,
            ...(visuals.length ? { usage } : {}),
          });
        }
        stage = 'extraction';
        let extracted = await deps.processing.internal.cached(
          run,
          documentId,
          stage,
          source.sourceDigest,
        );
        if (!extracted) {
          await step(run, { stage, documentId, status: 'running' });
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
            await current(run);
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
              provider: config.connection.id,
              model: config.extractionModel,
              execute: () =>
                deps.agents.model.extract({
                  connection: config.connection,
                  modelId: config.extractionModel,
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
            await step(run, { stage, documentId, status: 'running', usage });
          }
          extracted = stepOutputSchema.parse({
            version: 1,
            sourceDigest: source.sourceDigest,
            visuals: output.visuals,
            candidates: found,
          });
          await step(run, {
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
          visuals: output.visuals,
        });
        candidates.push(...extracted.candidates);
        completed++;
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof DocumentError && error.code === 'NOT_FOUND')
        )
          throw error;
        await current(run);
        failures++;
        await step(run, {
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
      run,
      config,
      fields: pack.fields,
      candidates,
      sources,
      failures,
      completed,
      signal,
      current: () => current(run),
    });
  };
}
