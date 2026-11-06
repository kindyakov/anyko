import type { ModelConnection } from '@anyko/llm';

export interface LlmConfiguration {
  revision: number;
  baseURL: string;
  visionModel: string;
  extractionModel: string;
}
export interface LlmSettingsStore {
  current(workspaceId: string): Promise<LlmConfiguration | null>;
  connection(
    workspaceId: string,
    revision: number,
  ): Promise<LlmConfiguration & { connection: ModelConnection }>;
  save(
    workspaceId: string,
    input: {
      baseURL: string;
      visionModel: string;
      extractionModel: string;
      apiKey?: string;
    },
  ): Promise<void>;
}
