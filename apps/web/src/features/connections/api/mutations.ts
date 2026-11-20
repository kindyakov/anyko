import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  revokeLlmSettings,
  saveLlmSettings,
} from '@anyko/contracts/connections';

import { invalidateWorkspaceWorks } from '@/features/works';
import { callApi } from '@/lib/api/call';

import { connectionKeys } from './keys';

// Ключ передаётся только когда его ввели: пустое поле означает «оставить текущий».
type LlmSettingsInput = {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  apiKey?: string;
};

async function refreshLlmSettings(client: QueryClient, workspaceId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: connectionKeys.llm(workspaceId) }),
    invalidateWorkspaceWorks(client, workspaceId),
  ]);
}

export function useSaveLlmSettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LlmSettingsInput) =>
      callApi(saveLlmSettings, { params: { workspaceId }, body: input }),
    // Ожидание обновления настроек входит в команду: форма получает актуальную версию до сообщения.
    onSuccess: () => refreshLlmSettings(client, workspaceId),
  });
}

export function useRevokeLlmSettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => callApi(revokeLlmSettings, { params: { workspaceId } }),
    onSuccess: () => refreshLlmSettings(client, workspaceId),
  });
}
