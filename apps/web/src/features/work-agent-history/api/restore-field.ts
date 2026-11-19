import { useMutation, useQueryClient } from '@tanstack/react-query';

import { editWork } from '@anyko/contracts/works';

import { invalidateWork } from '@/features/works';
import { callApi } from '@/lib/api/call';

import { agentHistoryRunKey } from './queries';

export function useRestoreField(
  workspaceId: string,
  workId: string,
  runId: string,
  eventId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (revision: number) =>
      callApi(editWork, {
        params: { workspaceId, workId },
        body: { revision, restore: { runId, eventId } },
      }),
    onSettled: () =>
      Promise.all([
        invalidateWork(client, workspaceId, workId),
        client.invalidateQueries({
          queryKey: agentHistoryRunKey(workspaceId, workId, runId),
        }),
      ]),
  });
}
