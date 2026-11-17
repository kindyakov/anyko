import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  revokeLlmSettings,
  saveLlmSettings,
} from '@anyko/contracts/connections';

import { callApi } from '@/lib/api/call';

import { connectionKeys } from './keys';

// Ключ передаётся только когда его ввели: пустое поле означает «оставить текущий».
type LlmSettingsInput = {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  apiKey?: string;
};

export function useSaveLlmSettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LlmSettingsInput) =>
      callApi(saveLlmSettings, { params: { workspaceId }, body: input }),
    // Ожидание обновления настроек входит в команду: форма получает актуальную версию до сообщения.
    onSuccess: () =>
      client.invalidateQueries({ queryKey: connectionKeys.llm(workspaceId) }),
  });
}

export function useRevokeLlmSettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => callApi(revokeLlmSettings, { params: { workspaceId } }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: connectionKeys.llm(workspaceId) }),
  });
}
