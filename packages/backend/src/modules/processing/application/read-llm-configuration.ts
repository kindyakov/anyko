import type { LlmSettingsStore } from '..';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Текущая ревизия настроек модели области для снимка запуска. Право на чтение настроек здесь не нужно:
// сценарий анализа уже проверил право на работу, а значения не возвращаются наружу.
export const readLlmConfiguration =
  (deps: { settings: LlmSettingsStore }) => (scope: WorkspaceScope) =>
    deps.settings.current(scope.workspaceId);
