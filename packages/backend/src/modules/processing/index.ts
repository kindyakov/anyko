import type { GenerationId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';

import type { WorkAttempt } from './application/work-attempt';
import type { WorkProcessingStore, WorkRuns } from './application/work-ports';

export {
  claimDocumentAttempt,
  type DocumentAttempt,
  documentOcrPolicy,
} from './application/document-attempt';
export type { DocumentArtifacts } from './application/ports';
export type { WorkAttempt } from './application/work-attempt';
export { stepOutputSchema } from './application/work-ports';

// Фасад запусков работы. Старт — внутренний шаг сценария, который уже проверил право (works.edit
// для анализа, works.generate для генерации); поля модели фиксируются в снимке запуска.
export interface WorkRunStart {
  workId: WorkId;
  kind: 'analysis' | 'generation' | 'chat';
  inputRevision: number;
  documentIds: string[];
  settingsRevision: number | null;
  generationId: GenerationId | null;
  correlationId: string;
  modelSnapshot: { vision: string; extraction: string };
}
export interface ProcessingCommands {
  start(scope: WorkspaceScope, input: WorkRunStart): Promise<string>;
}
// Внутренние запросы: право проверяет вызывающий сценарий.
export interface ProcessingQueries {
  isActive(
    scope: WorkspaceScope,
    workId: WorkId,
    kind?: 'chat',
  ): Promise<boolean>;
  runs(scope: WorkspaceScope, workId: WorkId): Promise<WorkRuns>;
}
// Управление запусками при удалении работы и учёт зарегистрированных потоков модели.
type WorkMaintenance = Pick<
  WorkProcessingStore,
  | 'thread'
  | 'threads'
  | 'cancel'
  | 'erase'
  | 'eraseThreads'
  | 'latestAnalysisRecovery'
  | 'sourceVisuals'
>;
export interface ProcessingPorts {
  readonly commands: ProcessingCommands;
  readonly queries: ProcessingQueries;
  readonly internal: WorkMaintenance & {
    active(workspaceId: string, workId: string): Promise<boolean>;
    startUploadAnalysis(
      workspaceId: string,
      actorId: string,
      input: Omit<WorkRunStart, 'kind' | 'generationId'>,
    ): Promise<void>;
  };
}
export interface ProcessingModule extends ProcessingPorts {
  claimAttempt: (
    workspaceId: string,
    runId: string,
  ) => Promise<WorkAttempt | null>;
  in(tx: Tx): ProcessingPorts;
}

export { createJobProcessing } from './application/job-scope';
export type { ExecutionScope } from '../../platform/scope/execution-scope';

export type { ProcessingIo } from './application/io';
