import { WorkError } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import { changeWork } from '../change-work';
import type { WorkDependencies } from '../work-dependencies';

type ChecklistDeps = Pick<
  WorkDependencies,
  'uow' | 'works' | 'processing' | 'locks' | 'templateRequirements'
>;
type ChecklistChange = {
  requirementKey: string;
  requirementLabel: string;
  documentId: string;
  filename: string;
  before: 'found' | 'review' | 'confirmed' | 'rejected' | null;
  after: 'confirmed' | 'rejected';
  revision: number;
};

export const editChecklistLink =
  (deps: ChecklistDeps) =>
  async (
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      requirementKey: string;
      documentId: DocumentId;
      decision: 'confirmed' | 'rejected';
      ocrRevision: number | null;
      revision?: number;
    },
    afterEdit?: (tx: Tx, change: ChecklistChange) => Promise<void>,
  ) => {
    scope.require('works.edit');
    const { workId, requirementKey, documentId, decision, ocrRevision } = input;
    let change: ChecklistChange | undefined;
    await changeWork(
      deps,
      scope,
      {
        workId,
        ...(input.revision !== undefined && {
          expectedRevision: input.revision,
        }),
        command: 'edit',
        event: 'checklist.changed',
      },
      async ({ work, documents }) => {
        const requirement = (
          await deps.templateRequirements(work.packageVersion)
        ).find(({ key }) => key === requirementKey);
        if (!requirement) throw new WorkError('INVALID_WORK_INPUT');
        const source = documents.find(
          ({ id, deleted }) => id === documentId && !deleted,
        );
        if (!source) throw new WorkError('NOT_FOUND');
        if (source.ocrRevision !== ocrRevision)
          throw new WorkError('REVISION_CONFLICT');
        return async (tx) => {
          const works = deps.works.in(tx);
          const current = await works.queries.activeDocument(
            scope,
            workId,
            documentId,
          );
          if (!current) throw new WorkError('NOT_FOUND');
          if (current.ocrRevision !== ocrRevision)
            throw new WorkError('REVISION_CONFLICT');
          const previous = (
            await works.internal.checklistLinks(scope.workspaceId, workId)
          ).find(
            (link) =>
              link.requirementKey === requirementKey &&
              link.documentId === documentId &&
              link.ocrRevision === ocrRevision,
          );
          if (previous?.decision !== decision) {
            await works.internal.saveChecklistLink(scope.workspaceId, workId, {
              documentId,
              requirementKey,
              decision,
              ocrRevision,
              quote:
                decision === 'confirmed' ? (previous?.quote ?? null) : null,
              page: decision === 'confirmed' ? (previous?.page ?? null) : null,
            });
          }
          change = {
            requirementKey,
            requirementLabel: requirement.label,
            documentId,
            filename: source.filename,
            before: previous?.decision ?? null,
            after: decision,
            revision: work.revision,
          };
          await afterEdit?.(tx, change);
        };
      },
    );
    if (!change) throw new Error('CHECKLIST_CHANGE_MISSING');
    return change;
  };
