import { LlmError } from '@anyko/llm';

import { visionPromptRevision } from '../../modules/agents';
import { DocumentError } from '../../modules/documents';
import { selectPackageCandidates, type WorkFacts } from '../../modules/facts';
import { stepOutputSchema, type WorkAttempt } from '../../modules/processing';
import { isAppError } from '../../platform/errors';
import type { WorkDependencies } from '../work-dependencies';
import { logWorkFailure } from '../work-execution/failure';
import { createRunState } from '../work-execution/run-state';

import {
  type ContinuationSource,
  createWorkContinuation,
} from './continue-session';
import { locateEvidence } from './locate-evidence';
import { addUsage, callModel } from './model-call';
import { digest, workAnalysisRevision } from './revision';

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
    const session = await attempt.write(
      (tx) => deps.agents.in(tx).internal.ensure(run.workspaceId, run.workId),
      signal,
    );
    const historyRef = {
      workspaceId: run.workspaceId,
      workId: run.workId,
      runId: run.id,
      sessionId: session.id,
    };
    const history = deps.agents.internal.history.record(historyRef);
    const parse = async (documentId: string) => {
      await step({ stage: 'parsing', documentId, status: 'running' });
      const { workspaceId, workId } = run;
      const load = async () => {
        const source = (
          await deps.works.internal.documents(workspaceId, workId)
        ).find((row) => row.id === documentId && !row.deleted);
        if (!source) throw new DocumentError('NOT_FOUND');
        const revision = source.ocrRevision;
        const doc = await deps.documents.internal.queries.get({
          workspaceId,
          documentId,
          revision,
        });
        return { revision, status: doc.status };
      };
      let source = await load();
      if (
        !run.automaticUpload &&
        source.status === 'failed' &&
        source.revision === null
      ) {
        try {
          await deps.documents.internal.commands.retry({
            workspaceId,
            documentId,
            actorId: 'work-pipeline',
            correlationId: run.correlationId,
          });
        } catch (error) {
          if (
            !(error instanceof DocumentError) ||
            error.code !== 'RETRY_CONFLICT'
          )
            throw error;
        }
        source = await load();
      }
      while (
        !run.automaticUpload &&
        (source.status === 'queued' || source.status === 'running')
      ) {
        signal.throwIfAborted();
        await current();
        await delay(signal);
        source = await load();
      }
      // Completion may commit between reading the link and the latest status.
      if (source.status === 'succeeded' && source.revision === null)
        source = await load();
      if (source.status !== 'succeeded' || source.revision === null)
        throw new Error('PARSING_FAILED');
      await step({ stage: 'parsing', documentId, status: 'succeeded' });
      const analysis = await deps.documents.internal.queries.analysis({
        workspaceId,
        documentId,
        revision: source.revision,
      });
      return { ...analysis, ocrRevision: source.revision };
    };
    const { revision } = await loadConnection(run.settingsRevision);
    const readConnection = () => loadConnection(revision);
    const assertCurrent = async () => {
      await current();
      await readConnection();
    };
    const pack = deps.resolvePackage((await current()).packageVersion);
    const { fields, excludedFields, plan: pilotPlan } = pack.analysis;
    const analysisRevision = workAnalysisRevision(
      fields,
      pilotPlan,
      pack.profile,
    );
    const candidates: WorkFacts['candidates'] = [];
    const sources: ContinuationSource[] = [];
    const sourceTexts: { documentId: string; text: string }[] = [];
    const unreadable = new Map<string, string>();
    const analyzed = new Set(run.documentIds);
    let failures = 0,
      completed = 0;
    for (const documentId of run.documentIds) {
      let stage: 'parsing' | 'vision' | 'extraction' = 'parsing';
      try {
        signal.throwIfAborted();
        await current();
        const source = await parse(documentId);
        sourceTexts.push({ documentId, text: source.text });
        // The persisted vision key is also read by chat and older workers.
        const visionDigest = source.images.length
          ? `vision-${String(visionPromptRevision)}:${source.sourceDigest}`
          : source.sourceDigest;
        stage = 'vision';
        let output = await attempt.cached(documentId, {
          stage,
          sourceDigest: visionDigest,
        });
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
          const nativeTables = new Set(
            source.tableImages
              ?.filter(({ origin }) => origin === 'native')
              .map(({ imagePath }) => imagePath),
          );
          const images = normalized.length ? normalized : source.images;
          for (const image of images.filter(
            ({ path }) => !nativeTables.has(path),
          )) {
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
                  trace: {
                    correlationId: run.correlationId,
                    jobId: run.id,
                    stage: 'ocr',
                    documentId,
                  },
                  observe: history.observe({
                    interactionId: callId,
                    stage: 'vision',
                    documentId,
                    imagePath: image.path,
                    provider: stepConnection.connection.id,
                    model: stepConnection.visionModel,
                  }),
                  assertCurrent,
                  connection: stepConnection.connection,
                  modelId: stepConnection.visionModel,
                  disableReasoning: stepConnection.visionDisableReasoning,
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
            sourceDigest: visionDigest,
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
        sourceTexts.push(
          ...output.visuals.map(({ description }) => ({
            documentId,
            text: description,
          })),
        );
        const prepared = {
          id: documentId,
          filename:
            (
              await deps.works.internal.documents(run.workspaceId, run.workId)
            ).find((d) => d.id === documentId)?.filename ?? documentId,
          digest: source.sourceDigest,
          ocrRevision: source.ocrRevision,
          text: source.text,
          ...(source.pdfOcr && { pdfOcr: source.pdfOcr }),
          visuals: output.visuals,
        };
        if (pilotPlan) {
          sources.push(prepared);
          completed++;
          continue;
        }
        const extractionRevision = digest([analysisRevision, output.visuals]);
        let extracted = await attempt.cached(documentId, {
          stage,
          sourceDigest: source.sourceDigest,
          stageRevision: extractionRevision,
        });
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
                  trace: {
                    correlationId: run.correlationId,
                    jobId: run.id,
                    stage: 'extraction',
                    documentId,
                  },
                  enableReasoning: stepConnection.extractionEnableReasoning,
                  onRejectedEvidence: (rejections) => {
                    for (const { field, count } of rejections)
                      deps.logger.warn({
                        event: 'extraction_candidates_rejected',
                        correlationId: run.correlationId,
                        jobId: run.id,
                        jobType: 'extraction',
                        requestId: threadId,
                        documentId,
                        errorCode: 'INVALID_EVIDENCE',
                        field,
                        rejectedCount: count,
                      });
                  },
                  observe: history.observe({
                    interactionId: threadId,
                    stage: 'extraction',
                    documentId,
                    provider: stepConnection.connection.id,
                    model: stepConnection.extractionModel,
                  }),
                  assertCurrent,
                  connection: stepConnection.connection,
                  modelId: stepConnection.extractionModel,
                  fields,
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
            found.push(...selectPackageCandidates(result.candidates, fields));
            usage = addUsage(usage, result.usage);
            await step({ stage, documentId, status: 'running', usage });
          }
          extracted = stepOutputSchema.parse({
            version: 1,
            sourceDigest: source.sourceDigest,
            stageRevision: extractionRevision,
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
        sources.push(prepared);
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
        const errorCode =
          error instanceof LlmError
            ? error.code
            : `${stage.toUpperCase()}_FAILED`;
        if (pilotPlan) unreadable.set(documentId, errorCode);
        await step({
          stage,
          documentId,
          status: 'failed',
          errorCode,
        });
        logWorkFailure(deps.logger, run, error, {
          code: errorCode,
          message:
            'Не удалось обработать исходник работы на этом этапе анализа.',
          operation: `work.analysis.${stage}`,
          state: 'failed',
        });
      }
    }
    // Upload runs extract only the new batch. Balance freshness also depends on
    // the recognized documents already attached to the work.
    const attached = await deps.works.internal.documents(
      run.workspaceId,
      run.workId,
    );
    for (const { id, deleted, ocrRevision } of attached) {
      if (deleted || ocrRevision === null || analyzed.has(id)) continue;
      signal.throwIfAborted();
      const { text } = await deps.documents.internal.queries.analysis({
        workspaceId: run.workspaceId,
        documentId: id,
        revision: ocrRevision,
      });
      sourceTexts.push({ documentId: id, text });
    }
    await continueSession({
      attempt,
      settingsRevision: revision,
      analysisRevision,
      readConnection,
      ...(pilotPlan && { pilotPlan }),
      fields,
      excludedFields,
      packageFields: pack.description.fields,
      candidates,
      sources,
      ...(unreadable.size && {
        unreadableSources: [...unreadable].map(([id, errorCode]) => ({
          filename:
            attached.find((document) => document.id === id)?.filename ?? id,
          errorCode,
        })),
      }),
      sourceTexts,
      failures,
      completed,
      signal,
      current,
    });
  };
}
