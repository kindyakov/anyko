import type { GenerationId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';

import type {
  LlmConfiguration,
  LlmSettingsStore,
} from './application/settings-ports';
import type { WorkProcessingStore, WorkRuns } from './application/work-ports';

export { createProcessingService } from './application/service';
export {
  createLlmSettings,
  type LlmSettingsApi,
} from './application/llm-settings';
export type {
  WorkProcessingStore,
  WorkRunRecord,
} from './application/work-ports';
export { stepOutputSchema } from './application/work-ports';
export type {
  LlmSettingsStore,
  LlmConfiguration,
} from './application/settings-ports';

// Фасад запусков работы. Старт — внутренний шаг сценария, который уже проверил право (works.edit
// для анализа, works.generate для генерации); поля модели фиксируются в снимке запуска.
export interface WorkRunStart {
  workId: WorkId;
  kind: 'analysis' | 'generation';
  inputRevision: number;
  documentIds: string[];
  settingsRevision: number | null;
  generationId: GenerationId | null;
  correlationId: string;
  modelSnapshot: { vision: string; extraction: string };
}
export interface ProcessingCommands {
  start(scope: WorkspaceScope, input: WorkRunStart): Promise<void>;
}
// Внутренние запросы: право проверяет вызывающий сценарий.
export interface ProcessingQueries {
  isActive(scope: WorkspaceScope, workId: WorkId): Promise<boolean>;
  runs(scope: WorkspaceScope, workId: WorkId): Promise<WorkRuns>;
  llmConfiguration(scope: WorkspaceScope): Promise<LlmConfiguration | null>;
}
// Внутренний порт исполнения запуска: исполнитель (worker) и процесс работы, который уже проверил право.
// Операции внутри UnitOfWork получаются через in(tx) тем же набором имён.
export interface ProcessingInternal extends Pick<
  WorkProcessingStore,
  | 'claim'
  | 'valid'
  | 'fence'
  | 'step'
  | 'finish'
  | 'cached'
  | 'thread'
  | 'threads'
  | 'erase'
  | 'eraseThreads'
  | 'delivery'
  | 'delivered'
  | 'release'
  | 'reconcile'
> {
  connection: LlmSettingsStore['connection'];
}
export interface ProcessingPorts {
  readonly commands: ProcessingCommands;
  readonly queries: ProcessingQueries;
  readonly internal: ProcessingInternal;
}
export interface ProcessingModule extends ProcessingPorts {
  in(tx: Tx): ProcessingPorts;
}
