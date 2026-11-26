import { DiagnosticError } from '@anyko/logger';

import { checksum } from '../../modules/documents';
import { generateDocument } from '../../modules/generation';
import type { WorkAttempt } from '../../modules/processing';
import type { WorkDependencies } from '../work-dependencies';
import { logWorkFailure } from '../work-execution/failure';
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
    const record =
      run.generationId &&
      (await deps.generation.internal.get(
        run.workspaceId,
        run.workId,
        run.generationId,
      ));
    if (!record)
      throw new DiagnosticError({
        code: 'GENERATION_MISSING',
        message: 'Не найдены данные задания на формирование документов.',
        operation: 'work.generation.load',
      });
    const resolved = deps.resolvePackage(record.packageVersion);
    const pack = await deps.templatePlaceholders(resolved.description);
    let completed = 0;
    await step({ stage: 'generation', status: 'running' });
    for (const file of record.files) {
      signal.throwIfAborted();
      await current();
      const template = pack.documents.find(
        (entry) => entry.version === file.templateVersion,
      );
      if (!template)
        throw new DiagnosticError({
          code: 'PACKAGE_TEMPLATE_MISMATCH',
          message: 'Шаблон формируемого файла отсутствует в пакете документов.',
          operation: 'work.generation.readTemplate',
        });
      const expected = resolved.templateBytes(template.version);
      const templateKey = `templates/${template.version}/${template.checksum}.docx`;
      if (!(await deps.storage.exists(templateKey)))
        await deps.storage.put(templateKey, expected, DOCX, signal);
      const source = await deps.storage.get(templateKey, signal);
      if ((await checksum(source)) !== template.checksum)
        throw new DiagnosticError({
          code: 'TEMPLATE_CHECKSUM_MISMATCH',
          message:
            'Контрольная сумма шаблона в хранилище отличается от утверждённой.',
          operation: 'work.generation.readTemplate',
        });
      let bytes: Uint8Array;
      try {
        bytes = generateDocument(
          source,
          resolved.templateData(
            record.values,
            template,
            record.createdAt.toISOString().slice(0, 10),
          ),
          {
            logger: deps.logger,
            templateVersion: template.version,
            jobId: run.id,
            correlationId: run.correlationId,
          },
        );
      } catch (error) {
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
        logWorkFailure(deps.logger, run, error, {
          code: 'DOCUMENT_GENERATION_FAILED',
          message: 'Не удалось сформировать файл из шаблона.',
          operation: 'work.generation.renderDocument',
          state: 'failed',
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
