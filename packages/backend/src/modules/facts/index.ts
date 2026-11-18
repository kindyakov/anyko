import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import type { FieldKey, FieldValues } from '../../profiles/bfl/fields';

import type { WorkFacts } from './schemas';

export { candidatesForContext } from './domain/candidates';
export {
  emptyFacts,
  findFactDiscrepancies,
  markSelectedCandidates,
} from './domain/values';
export type { WorkFacts } from './schemas';

export interface FactsStore {
  get(workspaceId: string, workId: string): Promise<WorkFacts>;
  save(workspaceId: string, workId: string, facts: WorkFacts): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}

// Фасад сведений. Правка и подтверждение меняют только сведения; ревизию работы меняет сценарий
// (workflows/work-review), потому что ревизия принадлежит works. Права works.edit проверяет команда.
export interface AcceptRunCandidatesInput extends AnalysisFactsRef {
  fields: readonly FieldKey[];
  confirmed: boolean;
  candidates: WorkFacts['candidates'];
  contextCandidates?: WorkFacts['candidates'];
}

export interface AcceptedRunCandidates {
  contextAccepted: boolean;
  missingFields: FieldKey[];
  discrepancyFields: FieldKey[];
}

interface FactsCommands {
  acceptRunCandidates(
    input: AcceptRunCandidatesInput,
  ): Promise<AcceptedRunCandidates>;
  edit(
    scope: WorkspaceScope,
    input: { workId: WorkId; values: FieldValues },
  ): Promise<void>;
  confirm(scope: WorkspaceScope, input: { workId: WorkId }): Promise<void>;
}
export interface AnalysisFactsRef {
  workspaceId: string;
  workId: string;
}
// Запросы внутренние: право или действующий запуск проверяет вызывающий сценарий.
interface FactsQueries {
  forAnalysis(input: AnalysisFactsRef): Promise<WorkFacts>;
  get(scope: WorkspaceScope, workId: WorkId): Promise<WorkFacts>;
}
export interface FactsPorts {
  readonly commands: FactsCommands;
  readonly queries: FactsQueries;
  // Внутренний порт обслуживания для удаления производных данных.
  readonly internal: Pick<FactsStore, 'erase'>;
}
export interface FactsModule extends FactsPorts {
  in(tx: Tx): FactsPorts;
}

export type { FieldValues } from '../../profiles/bfl/fields';
