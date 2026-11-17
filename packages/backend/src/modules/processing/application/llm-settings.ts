import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

import type { LlmConfiguration, LlmSettingsStore } from './settings-ports';

// Порт блокировки: настройки меняются под той же блокировкой ресурса, что и прежде (`llm-settings:<ws>`).
export interface SettingsLocks {
  run<T>(key: string, operation: () => Promise<T>): Promise<T>;
}

export interface LlmSettingsInput {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  apiKey?: string | undefined;
}

// Настройки модели рабочей области: читать может участник с connections.read, менять — только с
// connections.manage. Право проверяется сценарием после разбора входа HTTP.
export function createLlmSettings(deps: {
  settings: LlmSettingsStore;
  locks: SettingsLocks;
}) {
  return {
    async current(scope: WorkspaceScope) {
      scope.require('connections.read');
      const settings: LlmConfiguration | null = await deps.settings.current(
        scope.workspaceId,
      );
      return { settings, canManage: scope.has('connections.manage') };
    },
    async save(scope: WorkspaceScope, input: LlmSettingsInput) {
      scope.require('connections.manage');
      await deps.locks.run(`llm-settings:${scope.workspaceId}`, () =>
        deps.settings.save(scope.workspaceId, input, scope.userId),
      );
    },
  };
}

export type LlmSettingsApi = ReturnType<typeof createLlmSettings>;
