import type { AgentSessionStore } from '../../modules/agents';
import type { DocumentService, ResourceLocks } from '../../modules/documents';
import { emptyFacts, type FactsModule } from '../../modules/facts';
import type { GenerationModule } from '../../modules/generation';
import type { ProcessingModule } from '../../modules/processing';
import { requirePackage } from '../../modules/templates';
import type { WorksModule } from '../../modules/works';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireWork, workLockKey } from '../work-guards';

// Представление работы: сборка из модулей под блокировкой работы. Курсор читается первым: параллельные
// изменения придут повторно, но не пропадут. Пока исходники не готовы, сведения и запуски скрыты.
export const getWork =
  (deps: {
    works: WorksModule;
    facts: FactsModule;
    processing: ProcessingModule;
    generation: GenerationModule;
    documents: DocumentService;
    sessions: AgentSessionStore;
    locks: ResourceLocks;
  }) =>
  async (scope: WorkspaceScope, workId: WorkId) => {
    scope.require('works.read');
    return deps.locks.run(workLockKey(scope.workspaceId, workId), async () => {
      const cursor = await deps.works.queries.cursor(scope, workId);
      const work = await requireWork(deps.works.queries, scope, workId);
      const { documents: rows, cleanupPending } =
        await deps.works.queries.sources(scope, workId);
      const documents = [];
      for (const row of rows)
        if (!row.deleted) {
          try {
            documents.push(
              await deps.documents.get({
                workspaceId: scope.workspaceId,
                documentId: row.id,
              }),
            );
          } catch (error) {
            if (!(error instanceof Error && error.message === 'NOT_FOUND'))
              throw error;
          }
        }
      return {
        work,
        session: cleanupPending
          ? null
          : await deps.sessions.get(scope.workspaceId, workId),
        package: requirePackage(work.packageVersion),
        documents,
        facts: cleanupPending
          ? emptyFacts()
          : await deps.facts.queries.get(scope, workId),
        runs: cleanupPending
          ? []
          : await deps.processing.queries.runs(scope, workId),
        generations: cleanupPending
          ? []
          : await deps.generation.queries.list(scope, workId),
        cursor,
        cleanupPending,
      };
    });
  };
