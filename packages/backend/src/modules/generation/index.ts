import type { FieldValues, WorkView } from '@anyko/contracts';
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
  files: GenerationFile[];
}
export interface GenerationStore {
  create(
    input: Omit<GenerationRecord, 'files'> & {
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
  list(workspaceId: string, workId: string): Promise<WorkView['generations']>;
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
