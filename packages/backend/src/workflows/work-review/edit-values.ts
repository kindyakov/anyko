import {
  attachmentCategory,
  attachmentCopyKind,
  hasSubmittedAttachments,
  packageAttachment,
} from '@anyko/document-values/attachments';

import type { DocumentPackage } from '../../modules/templates';
import { WorkError } from '../../modules/works';
import { AppError, fieldErrors } from '../../platform/errors';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import {
  type FieldDefinition,
  type FieldKey,
  type FieldValue,
  type FieldValues,
  packageValuesSchema,
} from '../../profiles/fields';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import type { WorkDependencies } from '../work-dependencies';

type EditDeps = Pick<
  WorkDependencies,
  'uow' | 'works' | 'facts' | 'processing' | 'locks' | 'resolvePackage'
>;
type EditRequest = { workId: WorkId; revision: number };
type FieldEdit = { field: FieldKey; value: FieldValue };
type FieldChange = {
  field: FieldKey;
  before: FieldValue;
  after: FieldValue;
  revision: number;
};

function parseValues(values: unknown, fields: readonly FieldDefinition[]) {
  const parsed = packageValuesSchema(fields).safeParse(values);
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
  pack: DocumentPackage,
) {
  const attachments = pack.attachments ?? [];
  const rows = values.submittedAttachments;
  if (!Array.isArray(rows) || !rows.length) return;
  const seen = new Set<string>();
  if (
    !hasSubmittedAttachments(pack.fields) ||
    rows.some(({ documentId, description, category, copyKind }) => {
      if (!documentId || seen.has(documentId)) return true;
      seen.add(documentId);
      const fixed = packageAttachment(documentId, attachments);
      return (
        !description?.trim() ||
        !attachmentCategory(category) ||
        !attachmentCopyKind(copyKind) ||
        (fixed !== undefined &&
          (fixed.description !== description ||
            fixed.category !== category ||
            (fixed.originalOnly && copyKind !== 'paperOriginal')))
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
  if (
    [...seen].some(
      (id) => !active.has(id) && !packageAttachment(id, attachments),
    )
  )
    throw new WorkError('NOT_FOUND');
}

function saveWorkEdit(
  deps: EditDeps,
  scope: WorkspaceScope,
  input: EditRequest,
  apply: (tx: Tx, pack: DocumentPackage) => Promise<void>,
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
        apply(tx, deps.resolvePackage(work.packageVersion).description),
  );
}

export const editValues =
  (deps: EditDeps) =>
  async (scope: WorkspaceScope, input: EditRequest & { values: unknown }) => {
    scope.require(workCommandPolicy.edit.right);
    await saveWorkEdit(deps, scope, input, async (tx, pack) => {
      const { fields } = pack;
      const values = parseValues(input.values, fields);
      await validateSubmittedAttachments(
        deps,
        tx,
        scope,
        input.workId,
        values,
        pack,
      );
      await deps.facts
        .in(tx)
        .commands.edit(scope, { workId: input.workId, values, fields });
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
  await saveWorkEdit(deps, scope, input, async (tx, pack) => {
    const { fields } = pack;
    const { field, value } = await resolve(tx);
    if (!fields.some(({ key }) => key === field))
      throw new WorkError('INVALID_WORK_INPUT');
    const values = parseValues({ [field]: value }, fields);
    await validateSubmittedAttachments(
      deps,
      tx,
      scope,
      input.workId,
      values,
      pack,
    );
    const { before, after } = await deps.facts.in(tx).commands.edit(scope, {
      workId: input.workId,
      values,
      fields,
    });
    result.change = {
      field,
      before: before[field] ?? null,
      after: after[field] ?? null,
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
