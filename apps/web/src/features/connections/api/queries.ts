import { queryOptions } from '@tanstack/react-query';

import { getLlmSettings } from '@anyko/contracts/connections';

import { callApi } from '@/lib/api/call';

import { connectionKeys } from './keys';

export function llmSettingsQueryOptions(workspaceId: string) {
  return queryOptions({
    queryKey: connectionKeys.llm(workspaceId),
    queryFn: ({ signal }) =>
      callApi(getLlmSettings, { params: { workspaceId }, signal }),
  });
}
