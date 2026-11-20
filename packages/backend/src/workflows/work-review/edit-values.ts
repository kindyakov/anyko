import {
  attachmentCategory,
  attachmentCopyKind,
  hasSubmittedAttachments,
} from '@anyko/document-values/attachments';

import { requirePackage } from '../../modules/templates';
import { WorkError } from '../../modules/works';
import { AppError, fieldErrors } from '../../platform/errors';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import {
  emptyFieldValues,
  type FieldKey,
  type FieldValue,
  type FieldValues,
  fieldValuesSchema,
} from '../../profiles/bfl/fields';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import type { WorkDependencies } from '../work-dependencies';

type EditDeps = Pick<
  WorkDependencies,
  'uow' | 'works' | 'facts' | 'processing' | 'locks'
>;
type EditRequest = { workId: WorkId; revision: number };
type FieldEdit = { field: FieldKey; value: FieldValue };
type FieldChange = {
  field: FieldKey;
  before: FieldValue;
  after: FieldValue;
  revision: number;
};

function parseValues(values: unknown) {
  const parsed = fieldValuesSchema.safeParse(values);
  if (!parsed.success)
    throw new AppError('INVALID_WORK_INPUT', 'invalid', {
      fields: fieldErrors(parsed.error.issues, values, ['values']),
    });
  return parsed.data;
}

async function validateSubmittedAttachments(
  deps: EditDeps,
  tx: Tx,
  scope: WorkspaceScope,
  workId: WorkId,
  values: Partial<FieldValues>,
  packageVersion: string,
) {
  const rows = values.submittedAttachments;
  if (!Array.isArray(rows) || !rows.length) return;
  const seen = new Set<string>();
  if (
    !hasSubmittedAttachments(requirePackage(packageVersion).fields) ||
    rows.some(({ documentId, description, category, copyKind }) => {
      if (!documentId || seen.has(documentId)) return true;
      seen.add(documentId);
      return (
        !description?.trim() ||
        !attachmentCategory(category) ||
        !attachmentCopyKind(copyKind)
      );
    })
  ) {
    throw new WorkError('INVALID_WORK_INPUT');
  }
  const documents = await deps.works
    .in(tx)
    .internal.documents(scope.workspaceId, workId);
  const active = new Set(
    documents.filter(({ deleted }) => !deleted).map(({ id }) => id),
  );
  if ([...seen].some((id) => !active.has(id))) throw new WorkError('NOT_FOUND');
}

function saveWorkEdit(
  deps: EditDeps,
  scope: WorkspaceScope,
  input: EditRequest,
  apply: (tx: Tx, packageVersion: string) => Promise<void>,
) {
  return changeWork(
    deps,
    scope,
    {
      workId: input.workId,
      expectedRevision: input.revision,
      command: 'edit',
      advance: 'draft',
      event: 'facts.changed',
    },
    ({ work }) =>
      (tx) =>
        apply(tx, work.packageVersion),
  );
}

export const editValues =
  (deps: EditDeps) =>
  async (scope: WorkspaceScope, input: EditRequest & { values: unknown }) => {
    scope.require(workCommandPolicy.edit.right);
    const values = parseValues(input.values);
    await saveWorkEdit(deps, scope, input, async (tx, packageVersion) => {
      await validateSubmittedAttachments(
        deps,
        tx,
        scope,
        input.workId,
        values,
        packageVersion,
      );
      await deps.facts
        .in(tx)
        .commands.edit(scope, { workId: input.workId, values });
    });
  };

async function saveFieldEdit(
  deps: EditDeps,
  scope: WorkspaceScope,
  input: EditRequest,
  resolve: (tx: Tx) => FieldEdit | Promise<FieldEdit>,
  afterEdit?: (tx: Tx, change: FieldChange) => Promise<void>,
) {
  scope.require(workCommandPolicy.edit.right);
  const result: { change?: FieldChange } = {};
  await saveWorkEdit(deps, scope, input, async (tx, packageVersion) => {
    const { field, value } = await resolve(tx);
    const validated = parseValues({ ...emptyFieldValues(), [field]: value });
    const values = { [field]: validated[field] };
    await validateSubmittedAttachments(
      deps,
      tx,
      scope,
      input.workId,
      values,
      packageVersion,
    );
    const { before, after } = await deps.facts.in(tx).commands.edit(scope, {
      workId: input.workId,
      values,
    });
    result.change = {
      field,
      before: before[field],
      after: after[field],
      revision: input.revision + 1,
    };
    await afterEdit?.(tx, result.change);
  });
  if (!result.change) throw new Error('FIELD_CHANGE_MISSING');
  return result.change;
}

export const editWorkField =
  (deps: EditDeps) =>
  (
    scope: WorkspaceScope,
    input: EditRequest & FieldEdit,
    options?: { afterEdit?: (tx: Tx, change: FieldChange) => Promise<void> },
  ) =>
    saveFieldEdit(deps, scope, input, () => input, options?.afterEdit);

export const restoreField =
  (deps: EditDeps & Pick<WorkDependencies, 'agents'>) =>
  async (
    scope: WorkspaceScope,
    input: EditRequest & { runId: string; eventId: string },
  ) => {
    const { workId, runId, eventId } = input;
    await saveFieldEdit(deps, scope, input, async (tx) => {
      const change = await deps.agents.in(tx).internal.history.fieldChange({
        workspaceId: scope.workspaceId,
        workId,
        runId,
        eventId,
      });
      if (!change) throw new WorkError('NOT_FOUND');
      return { field: change.field, value: change.before };
    });
  };
