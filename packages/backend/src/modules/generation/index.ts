import type { GenerationId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import type { Tx } from '../../platform/transactions';
import type { FieldValues } from '../../profiles/fields';

import type { GenerationView } from './schemas';
export { generateDocument } from './render';

interface GenerationFile {
  id: string;
  templateVersion: string;
  title: string;
  filename: string;
  status: 'queued' | 'succeeded' | 'failed';
  errorCode: string | null;
  key: string | null;
  checksum: string | null;
}
interface GenerationRecord {
  id: string;
  workspaceId: string;
  workId: string;
  revision: number;
  confirmed: boolean;
  values: FieldValues;
  packageVersion: string;
  createdAt: Date;
  files: GenerationFile[];
}
export interface GenerationStore {
  create(
    input: Omit<GenerationRecord, 'createdAt' | 'files'> & {
      files: Pick<
        GenerationFile,
        'id' | 'templateVersion' | 'title' | 'filename'
      >[];
    },
  ): Promise<void>;
  get(
    workspaceId: string,
    workId: string,
    id: string,
  ): Promise<GenerationRecord | null>;
  list(workspaceId: string, workId: string): Promise<GenerationView[]>;
  publish(input: {
    workspaceId: string;
    workId: string;
    id: string;
    fileId: string;
    key: string;
    checksum: string;
  }): Promise<void>;
  failFile(
    workspaceId: string,
    generationId: string,
    fileId: string,
  ): Promise<void>;
  finish(
    workspaceId: string,
    generationId: string,
    status: 'succeeded' | 'partial' | 'failed',
  ): Promise<void>;
  fail(workspaceId: string, id: string): Promise<void>;
  stage(workspaceId: string, workId: string, key: string): Promise<void>;
  keys(workspaceId: string, workId: string): Promise<string[]>;
  erase(workspaceId: string, workId: string): Promise<void>;
}

// Фасад результатов генерации: снимок сведений и шаблонов фиксируется командой create.
export interface GenerationTemplate {
  templateVersion: string;
  title: string;
  filename: string;
}
interface GenerationCommands {
  create(
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      revision: number;
      confirmed: boolean;
      values: FieldValues;
      packageVersion: string;
      templates: GenerationTemplate[];
    },
  ): Promise<GenerationId>;
}
// Внутренние запросы: право проверяет вызывающий сценарий.
interface GenerationQueries {
  get(
    scope: WorkspaceScope,
    workId: WorkId,
    generationId: GenerationId,
  ): Promise<GenerationRecord | null>;
  list(scope: WorkspaceScope, workId: WorkId): Promise<GenerationView[]>;
}
export interface GenerationPorts {
  readonly commands: GenerationCommands;
  readonly queries: GenerationQueries;
  // Внутренний порт исполнения генерации: файлы, публикация и итог вызывает процесс worker.
  readonly internal: Pick<
    GenerationStore,
    | 'get'
    | 'keys'
    | 'stage'
    | 'failFile'
    | 'fail'
    | 'publish'
    | 'finish'
    | 'erase'
  >;
}
export interface GenerationModule extends GenerationPorts {
  in(tx: Tx): GenerationPorts;
}

export type { FieldValues } from '../../profiles/fields';
