import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import type { FactPolicy } from '../../profiles/fact-policy';
import type {
  FieldDefinition,
  FieldKey,
  FieldValues,
} from '../../profiles/fields';

import type { RunProposals } from './application/project-run-facts';
import type { FactEvidence } from './domain/values';
import type { WorkFacts } from './schemas';

export {
  candidatesForContext,
  selectPackageCandidates,
} from './domain/candidates';
export {
  emptyFacts,
  findFactDiscrepancies,
  markSelectedCandidates,
  refreshFactEvidence,
  type FactEvidence,
} from './domain/values';
export { projectRunFacts } from './application/project-run-facts';
export type { WorkFacts } from './schemas';

export interface FactsStore {
  get(workspaceId: string, workId: string): Promise<WorkFacts>;
  save(workspaceId: string, workId: string, facts: WorkFacts): Promise<void>;
  erase(workspaceId: string, workId: string): Promise<void>;
}

export interface AnalysisFactsRef {
  workspaceId: string;
  workId: string;
}

export type AcceptRunCandidatesInput = AnalysisFactsRef & RunProposals;

export interface AcceptedRunCandidates {
  contextAccepted: boolean;
  missingFields: FieldKey[];
  discrepancyFields: FieldKey[];
  proposalOutcomes: {
    candidate: WorkFacts['candidates'][number];
    stage: 'extraction' | 'reconciliation';
    status: 'applied' | 'matched' | 'retained' | 'review' | 'rejected';
  }[];
}

interface FactsCommands {
  acceptRunCandidates(
    input: AcceptRunCandidatesInput,
  ): Promise<AcceptedRunCandidates>;
  edit(
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      values: Partial<FieldValues>;
      fields: readonly FieldDefinition[];
    },
  ): Promise<{ before: FieldValues; after: FieldValues }>;
  confirm(
    scope: WorkspaceScope,
    input: { workId: WorkId; fields: readonly FieldDefinition[] },
  ): Promise<void>;
}
// Запросы внутренние: право или действующий запуск проверяет вызывающий сценарий.
interface FactsQueries {
  forAnalysis(
    input: AnalysisFactsRef,
    fields: readonly FieldDefinition[],
  ): Promise<WorkFacts>;
  get(
    scope: WorkspaceScope,
    workId: WorkId,
    fields: readonly FieldDefinition[],
  ): Promise<WorkFacts>;
}
// Фасад сведений. Правка и подтверждение меняют только сведения; ревизию работы меняет сценарий
// (workflows/work-review), потому что ревизия принадлежит works. Права works.edit проверяет команда.
export interface FactsPorts {
  readonly commands: FactsCommands;
  readonly queries: FactsQueries;
  // Внутренний порт обслуживания для удаления производных данных.
  readonly internal: Pick<FactsStore, 'erase'> & {
    removeSubmittedAttachment(
      workspaceId: string,
      workId: string,
      documentId: string,
      fields: readonly FieldDefinition[],
    ): Promise<void>;
    defaultDocumentDate(
      workspaceId: string,
      workId: string,
      date: string,
    ): Promise<void>;
    refreshEvidence(
      workspaceId: string,
      workId: string,
      refresh: (evidence: FactEvidence) => FactEvidence | null,
      fields: readonly FieldDefinition[],
      factPolicy?: FactPolicy,
    ): Promise<WorkFacts>;
  };
}
export interface FactsModule extends FactsPorts {
  in(tx: Tx): FactsPorts;
}

export type { FieldValues } from '../../profiles/fields';
