import { queryOptions } from '@tanstack/react-query';

import { llmSettingsResponseSchema } from '@anyko/contracts';

import { requestApi } from '@/lib/api/client';

import { connectionKeys } from './keys';

export function llmSettingsQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: connectionKeys.llm(workspaceId),
    queryFn: ({ signal }) =>
      requestApi('/settings/llm', llmSettingsResponseSchema, { signal }),
  });
}
