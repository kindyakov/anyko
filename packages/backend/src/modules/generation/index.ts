import type { FieldValues, WorkView } from '@anyko/contracts';
export { generateDocument } from './render';

interface GenerationRecord {
  id: string;
  workspaceId: string;
  workId: string;
  revision: number;
  confirmed: boolean;
  values: FieldValues;
  templateVersion: string;
  key: string | null;
  checksum: string | null;
}
export interface GenerationStore {
  create(input: Omit<GenerationRecord, 'key' | 'checksum'>): Promise<void>;
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
    key: string;
    checksum: string;
  }): Promise<void>;
  fail(workspaceId: string, id: string): Promise<void>;
  stage(workspaceId: string, workId: string, key: string): Promise<void>;
  keys(workspaceId: string, workId: string): Promise<string[]>;
  erase(workspaceId: string, workId: string): Promise<void>;
}
