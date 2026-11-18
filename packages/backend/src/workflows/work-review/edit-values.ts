import type { ResourceLocks } from '../../modules/documents';
import type { FactsModule } from '../../modules/facts';
import type { ProcessingModule } from '../../modules/processing';
import type { WorksModule } from '../../modules/works';
import { AppError, fieldErrors } from '../../platform/errors';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { UnitOfWork } from '../../platform/transactions';
import { fieldValuesSchema } from '../../profiles/bfl/fields';
import { changeWork } from '../change-work';

// Правка значений юристом по ожидаемой ревизии: сведения и ревизия работы меняются одной транзакцией.
export const editValues =
  (deps: {
    uow: UnitOfWork;
    works: WorksModule;
    facts: FactsModule;
    processing: ProcessingModule;
    locks: ResourceLocks;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; revision: number; values: unknown },
  ) => {
    scope.require('works.edit');
    const parsed = fieldValuesSchema.safeParse(input.values);
    if (!parsed.success)
      throw new AppError('INVALID_WORK_INPUT', 'invalid', {
        fields: fieldErrors(parsed.error.issues, input.values, ['values']),
      });
    await changeWork(
      deps,
      scope,
      {
        workId: input.workId,
        expectedRevision: input.revision,
        requireIdle: false,
        advance: 'draft',
        event: 'facts.changed',
      },
      () => (tx) =>
        deps.facts.in(tx).commands.edit(scope, {
          workId: input.workId,
          values: parsed.data,
        }),
    );
  };
