import { mergeCandidates } from '../../modules/facts';
import { checksum, DocumentError } from '../../modules/documents';
import {
  templateBytes,
  requirePackage,
  templateData,
} from '../../modules/templates';
import { generateDocument } from '../../modules/generation';
import { stepOutputSchema } from '../../modules/processing';
import type {
  WorkRunRecord,
  WorkProcessingStore,
} from '../../modules/processing';
import type { WorkFacts } from '@anyko/contracts';
import { LlmError } from '@anyko/llm';
import type { WorkDependencies } from './ports';
import { addUsage, callModel } from './model-call';

type StepInput = Parameters<WorkProcessingStore['step']>[1];
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

export function createWorkExecution(deps: WorkDependencies) {
  const current = async (run: WorkRunRecord) => {
    const work = await deps.works.get(run.workspaceId, run.workId);
    const docs = await deps.works.documents(run.workspaceId, run.workId);
    if (
      !work ||
      work.inputRevision !== run.inputRevision ||
      docs.some((doc) => doc.deleted) ||
      !(await deps.processing.valid(run))
    )
      throw new Error('STALE_WORK_ATTEMPT');
    return work;
  };
  const step = async (run: WorkRunRecord, input: StepInput) => {
    await deps.processing.step(run, input);
    deps.logger.info({
      event: 'work_step_changed',
      jobId: run.id,
      jobType: input.stage,
      state: input.status,
      correlationId: run.correlationId,
    });
    await deps.works.event(run.workspaceId, run.workId, 'processing.changed');
  };
  const parse = async (
    run: WorkRunRecord,
    documentId: string,
    signal: AbortSignal,
  ) => {
    await step(run, { stage: 'parsing', documentId, status: 'running' });
    let doc = await deps.documents.get({
      workspaceId: run.workspaceId,
      documentId,
    });
    if (doc.status === 'failed')
      doc = await deps.documents.retry({
        workspaceId: run.workspaceId,
        documentId,
        actorId: 'work-pipeline',
        correlationId: run.correlationId,
      });
    while (doc.status === 'queued' || doc.status === 'running') {
      signal.throwIfAborted();
      await current(run);
      await delay(signal);
      doc = await deps.documents.get({
        workspaceId: run.workspaceId,
        documentId,
      });
    }
    if (doc.status !== 'succeeded') throw new Error('PARSING_FAILED');
    await step(run, { stage: 'parsing', documentId, status: 'succeeded' });
    return deps.documents.analysis({
      workspaceId: run.workspaceId,
      documentId,
    });
  };
  const analysis = async (run: WorkRunRecord, signal: AbortSignal) => {
    if (run.settingsRevision === null) throw new Error('LLM_NOT_CONFIGURED');
    const config = await deps.settings.connection(
      run.workspaceId,
      run.settingsRevision,
    );
    const pack = requirePackage((await current(run)).packageVersion);
    const candidates: WorkFacts['candidates'] = [];
    let failures = 0,
      completed = 0;
    for (const documentId of run.documentIds) {
      let stage: 'parsing' | 'vision' | 'extraction' = 'parsing';
      try {
        signal.throwIfAborted();
        await current(run);
        const source = await parse(run, documentId, signal);
        stage = 'vision';
        let output = await deps.processing.cached(
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
            const callId = crypto.randomUUID();
            const result = await callModel({
              logger: deps.logger,
              callId,
              runId: run.id,
              correlationId: run.correlationId,
              stage,
              provider: config.connection.id,
              model: config.visionModel,
              execute: () =>
                deps.agents.describe({
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
        let extracted = await deps.processing.cached(
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
            const threadId = crypto.randomUUID();
            await deps.processing.thread(run.workspaceId, run.workId, threadId);
            const result = await callModel({
              logger: deps.logger,
              callId: threadId,
              runId: run.id,
              correlationId: run.correlationId,
              stage,
              provider: config.connection.id,
              model: config.extractionModel,
              execute: () =>
                deps.agents.extract({
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
    await deps.locks.run(`work:${run.workspaceId}:${run.workId}`, async () => {
      const work = await current(run);
      await deps.transaction(async ({ facts, works, processing }) => {
        if (candidates.length > 500) throw new Error('CANDIDATE_LIMIT');
        const existing = await facts.get(run.workspaceId, run.workId);
        await facts.save(
          run.workspaceId,
          run.workId,
          mergeCandidates(
            existing,
            candidates,
            work.confirmedRevision === work.revision,
          ),
        );
        await processing.step(run, {
          stage: 'reconciliation',
          status: 'succeeded',
        });
        await works.touch(run.workspaceId, run.workId, {});
        await processing.finish(
          run,
          completed === 0 ? 'failed' : failures ? 'partial' : 'succeeded',
        );
        await works.event(run.workspaceId, run.workId, 'facts.changed');
      });
    });
  };
  const generation = async (run: WorkRunRecord, signal: AbortSignal) => {
    if (!run.generationId) throw new Error('GENERATION_MISSING');
    const record = await deps.generation.get(
      run.workspaceId,
      run.workId,
      run.generationId,
    );
    if (!record) throw new Error('GENERATION_MISSING');
    const pack = requirePackage(record.packageVersion);
    const data = templateData(record.values);
    let completed = 0;
    await step(run, { stage: 'generation', status: 'running' });
    for (const file of record.files) {
      signal.throwIfAborted();
      await current(run);
      const template = pack.documents.find(
        (entry) => entry.version === file.templateVersion,
      );
      if (!template) throw new Error('PACKAGE_TEMPLATE_MISMATCH');
      const expected = templateBytes(template.version);
      const templateKey = `templates/${template.version}/${template.checksum}.docx`;
      if (!(await deps.storage.exists(templateKey)))
        await deps.storage.put(
          templateKey,
          expected,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          signal,
        );
      const source = await deps.storage.get(templateKey, signal);
      if ((await checksum(source)) !== template.checksum)
        throw new Error('TEMPLATE_CHECKSUM_MISMATCH');
      let bytes: Uint8Array;
      try {
        bytes = generateDocument(source, data);
      } catch {
        await deps.generation.failFile(run.workspaceId, record.id, file.id);
        await deps.works.event(
          run.workspaceId,
          run.workId,
          'generation.file.failed',
        );
        continue;
      }
      const key = `generated/${run.workspaceId}/${run.workId}/${crypto.randomUUID()}.docx`;
      await deps.generation.stage(run.workspaceId, run.workId, key);
      // Storage errors propagate to the durable I/O barrier; never hide an unknown PUT outcome.
      await deps.storage.put(
        key,
        bytes,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        signal,
      );
      await deps.locks.run(
        `work:${run.workspaceId}:${run.workId}`,
        async () => {
          await current(run);
          await deps.transaction(async ({ generation: store, works }) => {
            await store.publish({
              workspaceId: run.workspaceId,
              workId: run.workId,
              id: record.id,
              fileId: file.id,
              key,
              checksum: await checksum(bytes),
            });
            await works.event(
              run.workspaceId,
              run.workId,
              'generation.file.ready',
            );
          });
        },
      );
      completed++;
    }
    const status =
      completed === record.files.length
        ? 'succeeded'
        : completed
          ? 'partial'
          : 'failed';
    await deps.locks.run(`work:${run.workspaceId}:${run.workId}`, async () => {
      await current(run);
      await deps.transaction(
        async ({ generation: store, processing, works }) => {
          await store.finish(run.workspaceId, record.id, status);
          await processing.step(run, {
            stage: 'generation',
            status: status === 'succeeded' ? 'succeeded' : 'failed',
          });
          await processing.finish(run, status);
          await works.event(run.workspaceId, run.workId, 'generation.ready');
        },
      );
    });
  };

  return async (workspaceId: string, runId: string, signal: AbortSignal) => {
    await deps.locks.run(
      `work-run:${workspaceId}:${runId}`,
      async (lockSignal) => {
        const run = await deps.processing.claim(workspaceId, runId);
        if (!run) return;
        deps.logger.info({
          event: 'work_started',
          jobId: run.id,
          jobType: run.kind,
          correlationId: run.correlationId,
        });
        const bounded = AbortSignal.any([
          signal,
          lockSignal,
          AbortSignal.timeout(1_500_000),
        ]);
        const guarded = (index: number): Promise<void> => {
          const id = run.documentIds[index];
          return id
            ? deps.documentIo.run({ workspaceId, documentId: id }, () =>
                guarded(index + 1),
              )
            : run.kind === 'analysis'
              ? analysis(run, bounded)
              : generation(run, bounded);
        };
        try {
          await deps.workIo.run(workspaceId, run.workId, () => guarded(0));
        } catch (error) {
          await deps.processing.finish(
            run,
            bounded.aborted ? 'cancelled' : 'failed',
            error instanceof LlmError ? error.code : 'WORK_PROCESSING_FAILED',
          );
          if (run.generationId)
            await deps.generation.fail(workspaceId, run.generationId);
          await deps.works.event(workspaceId, run.workId, 'processing.failed');
          deps.logger.error({
            event: 'work_processing_failed',
            correlationId: run.correlationId,
            errorCode:
              error instanceof LlmError ? error.code : 'WORK_PROCESSING_FAILED',
          });
        }
      },
    );
  };
}
