import { inOperation } from '@anyko/logger';

import type { AgentsModule } from '../../modules/agents';
import type { ConnectionsModule } from '../../modules/connections';
import type { DocumentsModule, ResourceLocks } from '../../modules/documents';
import {
  emptyFacts,
  type FactsModule,
  findFactDiscrepancies,
  markSelectedCandidates,
} from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import {
  type ReadTemplatePlaceholders,
  type ReadTemplateRequirements,
} from '../../modules/templates';
import { projectChecklist, type WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork, workLockKey } from '../work-guards';
import type { ResolveWorkPackage } from '../work-package';

import { checklistWithContracts } from './checklist-contracts';
import { workAvailability } from './work-availability';

// Представление работы: сборка из модулей под блокировкой работы. Курсор читается первым: параллельные
// изменения придут повторно, но не пропадут. Пока исходники не готовы, сведения и запуски скрыты.
export const getWork =
  (deps: {
    works: WorksModule;
    resolvePackage: ResolveWorkPackage;
    facts: FactsModule;
    processing: ProcessingModule;
    connections: ConnectionsModule;
    generation: GenerationModule;
    templatePlaceholders: ReadTemplatePlaceholders;
    templateRequirements: ReadTemplateRequirements;
    documents: DocumentsModule;
    agents: AgentsModule;
    locks: ResourceLocks;
  }) =>
  async (scope: WorkspaceScope, workId: WorkId) => {
    scope.require('works.read');
    return deps.locks.run(workLockKey(scope.workspaceId, workId), async () => {
      const cursor = await deps.works.queries.cursor(scope, workId);
      const work = await requireWork(deps.works.queries, scope, workId);
      const sources = await deps.works.queries.sources(scope, workId);
      const { documents: rows, cleanupPending } = sources;
      const pendingUploadCount = await deps.works.internal.pendingUploadCount(
        scope.workspaceId,
        workId,
      );
      const documents = [];
      for (const row of rows)
        if (!row.deleted) {
          try {
            documents.push(
              await deps.documents.internal.queries.get({
                workspaceId: scope.workspaceId,
                documentId: row.id,
                revision: row.ocrRevision,
              }),
            );
          } catch (error) {
            if (!(error instanceof Error && error.message === 'NOT_FOUND'))
              throw error;
          }
        }
      const { description: pack } = deps.resolvePackage(work.packageVersion);
      const facts = cleanupPending
        ? emptyFacts(pack.fields)
        : await deps.facts.queries.get(scope, workId, pack.fields);
      const requirements = await deps.templateRequirements(work.packageVersion);
      const checklist = projectChecklist(
        requirements,
        requirements.length && !cleanupPending
          ? await deps.works.internal.checklistLinks(scope.workspaceId, workId)
          : [],
        rows,
      );
      const availability = await workAvailability(
        deps,
        scope,
        workId,
        sources,
        !!facts.needsReview?.length,
        pendingUploadCount > 0,
      );
      return {
        work,
        session: cleanupPending
          ? null
          : await deps.agents.internal.get(scope.workspaceId, workId),
        package: await inOperation('works.getDetails', () =>
          deps.templatePlaceholders(pack),
        ),
        documents,
        checklist: checklistWithContracts(checklist, facts),
        canEditChecklist: scope.has('works.edit') && !cleanupPending,
        facts: {
          ...facts,
          candidates: markSelectedCandidates(facts, pack.fields),
        },
        discrepancyFields: findFactDiscrepancies(facts, pack.fields),
        runs: cleanupPending
          ? []
          : await deps.processing.queries.runs(scope, workId),
        generations: cleanupPending
          ? []
          : await deps.generation.queries.list(scope, workId),
        cursor,
        cleanupPending,
        pendingUploadCount,
        availability,
      };
    });
  };
