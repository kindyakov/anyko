import type { ModelConnection } from '@anyko/llm';

export interface LlmConfiguration {
  revision: number;
  baseURL: string;
  visionModel: string;
  extractionModel: string;
}
export interface LlmSettingsStore {
  lock(workspaceId: string): Promise<void>;
  revoke(
    workspaceId: string,
    now: Date,
  ): Promise<{ revision: number; count: number } | null>;
  current(workspaceId: string): Promise<LlmConfiguration | null>;
  connection(
    workspaceId: string,
    revision: number | null,
  ): Promise<LlmConfiguration & { connection: ModelConnection }>;
  save(
    workspaceId: string,
    input: {
      baseURL: string;
      visionModel: string;
      extractionModel: string;
      apiKey?: string | undefined;
    },
  ): Promise<number>;
}
