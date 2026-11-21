import {
  infiniteQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createWorkChatMessage,
  listWorkChatMessages,
} from '@anyko/contracts/works';

import { callApi } from '@/lib/api/call';
import {
  createIdempotencyKey,
  withIdempotencyKey,
} from '@/lib/api/idempotency';

const chatKey = (workspaceId: string, workId: string) =>
  ['work-chat', workspaceId, workId] as const;

export function chatMessagesQuery(workspaceId: string, workId: string) {
  return infiniteQueryOptions({
    queryKey: chatKey(workspaceId, workId),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      callApi(listWorkChatMessages, {
        params: { workspaceId, workId },
        query: { page: pageParam },
        signal,
      }),
    getNextPageParam: ({ page, pageSize, total }) =>
      page * pageSize < total ? page + 1 : undefined,
    gcTime: 0,
  });
}

export function useSendChatMessage(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      userText,
      key,
    }: {
      userText: string;
      key: ReturnType<typeof createIdempotencyKey>;
    }) =>
      withIdempotencyKey(key, (idempotencyKey) =>
        callApi(createWorkChatMessage, {
          params: { workspaceId, workId },
          body: { userText },
          idempotencyKey,
        }),
      ),
    onSettled: () =>
      client.invalidateQueries({ queryKey: chatKey(workspaceId, workId) }),
  });
}
