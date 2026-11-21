import type { ModelConnection } from '@anyko/llm';

export interface LlmSettingsInput {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  visionDisableReasoning?: boolean | undefined;
  extractionEnableReasoning?: boolean | undefined;
  apiKey?: string | undefined;
}

export interface LlmConfiguration {
  revision: number;
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  visionDisableReasoning: boolean;
  extractionEnableReasoning: boolean;
}
export interface LlmSettingsStore {
  lock(workspaceId: string): Promise<void>;
  revoke(
    workspaceId: string,
    now: Date,
  ): Promise<{ revision: number; count: number } | null>;
  current(
    workspaceId: string,
    rejectRevoked?: boolean,
  ): Promise<LlmConfiguration | null>;
  connection(
    workspaceId: string,
    revision: number | null,
  ): Promise<LlmConfiguration & { connection: ModelConnection }>;
  save(workspaceId: string, input: LlmSettingsInput): Promise<number>;
}
