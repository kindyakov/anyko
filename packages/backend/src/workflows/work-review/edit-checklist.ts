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
    },
    afterEdit?: (
      tx: Tx,
      change: {
        requirementKey: string;
        requirementLabel: string;
        documentId: string;
        filename: string;
        decision: 'confirmed' | 'rejected';
      },
    ) => Promise<void>,
  ) => {
    scope.require('works.edit');
    const { workId, requirementKey, documentId, decision, ocrRevision } = input;
    await changeWork(
      deps,
      scope,
      { workId, command: 'edit', event: 'checklist.changed' },
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
          await works.internal.saveChecklistLink(scope.workspaceId, workId, {
            documentId,
            requirementKey,
            decision,
            ocrRevision,
            quote: decision === 'confirmed' ? (previous?.quote ?? null) : null,
            page: decision === 'confirmed' ? (previous?.page ?? null) : null,
          });
          await afterEdit?.(tx, {
            requirementKey,
            requirementLabel: requirement.label,
            documentId,
            filename: source.filename,
            decision,
          });
        };
      },
    );
  };
