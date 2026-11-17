import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workResponseSchema } from '@anyko/contracts/works';

import { requestApi } from '@/lib/api/client';
import { useWorkspaceId } from '@/lib/api/workspace';

import { workKeys } from './keys';

export type CreateWorkInput = { title: string; packageVersion: string };

export function useCreateWork() {
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkInput) =>
      requestApi('/works', workResponseSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: workKeys.list(workspaceId) });
    },
  });
}
