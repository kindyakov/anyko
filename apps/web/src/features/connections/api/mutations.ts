import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { requestApi } from '@/lib/api/client';

import { connectionKeys } from './keys';

// Ключ передаётся только когда его ввели: пустое поле означает «оставить текущий».
type LlmSettingsInput = {
  baseURL: string;
  visionModel: string;
  extractionModel: string;
  apiKey?: string;
};

const saved = z.object({ status: z.literal('saved') });

export function useSaveLlmSettings(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LlmSettingsInput) =>
      requestApi('/settings/llm', saved, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    // Ожидание обновления настроек входит в команду: форма получает актуальную версию до сообщения.
    onSuccess: () =>
      client.invalidateQueries({ queryKey: connectionKeys.llm(workspaceId) }),
  });
}
