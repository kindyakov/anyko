import { checksum } from '../../modules/documents';
import { generateDocument } from '../../modules/generation';
import type { WorkAttempt } from '../../modules/processing';
import {
  requirePackage,
  templateBytes,
  templateData,
} from '../../modules/templates';
import type { WorkDependencies } from '../work-dependencies';
import { createRunState } from '../work-execution/run-state';
import { guardWorkRevision, workLockKey } from '../work-guards';

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Исполнение генерации: файлы по шаблонам из снимка запуска, публикация и итог. Внешние записи — вне
// UnitOfWork; публикация файла и итог запуска — отдельные транзакции.
export function createWorkGenerationRun(deps: WorkDependencies) {
  return async (attempt: WorkAttempt, signal: AbortSignal) => {
    const { run } = attempt;
    const { current, step } = createRunState(deps, attempt);
    const write: WorkAttempt['write'] = (apply) =>
      deps.locks.run(
        workLockKey(run.workspaceId, run.workId),
        async (lockSignal) => {
          const work = await current();
          return attempt.write(async (tx, attemptWrite) => {
            await guardWorkRevision(
              deps.works.in(tx).internal,
              run,
              work.revision,
              lockSignal,
            );
            return apply(tx, attemptWrite);
          }, lockSignal);
        },
        signal,
      );
    if (!run.generationId) throw new Error('GENERATION_MISSING');
    const record = await deps.generation.internal.get(
      run.workspaceId,
      run.workId,
      run.generationId,
    );
    if (!record) throw new Error('GENERATION_MISSING');
    const pack = await deps.templatePlaceholders(
      requirePackage(record.packageVersion),
    );
    let completed = 0;
    await step({ stage: 'generation', status: 'running' });
    for (const file of record.files) {
      signal.throwIfAborted();
      await current();
      const template = pack.documents.find(
        (entry) => entry.version === file.templateVersion,
      );
      if (!template) throw new Error('PACKAGE_TEMPLATE_MISMATCH');
      const expected = templateBytes(template.version);
      const templateKey = `templates/${template.version}/${template.checksum}.docx`;
      if (!(await deps.storage.exists(templateKey)))
        await deps.storage.put(templateKey, expected, DOCX, signal);
      const source = await deps.storage.get(templateKey, signal);
      if ((await checksum(source)) !== template.checksum)
        throw new Error('TEMPLATE_CHECKSUM_MISMATCH');
      let bytes: Uint8Array;
      try {
        bytes = generateDocument(
          source,
          templateData(record.values, template.version, template.placeholders),
        );
      } catch {
        await write(async (tx) => {
          await deps.generation
            .in(tx)
            .internal.failFile(run.workspaceId, record.id, file.id);
          await deps.works
            .in(tx)
            .internal.event(
              run.workspaceId,
              run.workId,
              'generation.file.failed',
            );
        });
        continue;
      }
      const key = `generated/${run.workspaceId}/${run.workId}/${deps.newId()}.docx`;
      await deps.generation.internal.stage(run.workspaceId, run.workId, key);
      // Storage errors propagate to the durable I/O barrier; never hide an unknown PUT outcome.
      await deps.storage.put(key, bytes, DOCX, signal);
      await write(async (tx) => {
        await deps.generation.in(tx).internal.publish({
          workspaceId: run.workspaceId,
          workId: run.workId,
          id: record.id,
          fileId: file.id,
          key,
          checksum: await checksum(bytes),
        });
        await deps.works
          .in(tx)
          .internal.event(run.workspaceId, run.workId, 'generation.file.ready');
      });
      completed++;
    }
    const status =
      completed === record.files.length
        ? 'succeeded'
        : completed
          ? 'partial'
          : 'failed';
    await write(async (tx, attemptWrite) => {
      const generation = deps.generation.in(tx).internal;
      await generation.finish(run.workspaceId, record.id, status);
      await attemptWrite.step({
        stage: 'generation',
        status: status === 'succeeded' ? 'succeeded' : 'failed',
      });
      await attemptWrite.finish({ status });
      await deps.works
        .in(tx)
        .internal.event(run.workspaceId, run.workId, 'generation.ready');
    });
  };
}
