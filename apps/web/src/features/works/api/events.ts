'use client';

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  type ChatProgress,
  chatProgress,
  streamWorkEvents,
} from '@anyko/contracts/works';

import { endpointUrl } from '@/lib/api/call';

import { workKeys } from './keys';

export type WorkLive = 'connecting' | 'live' | 'reconnecting';

const chatProgressKey = (workspaceId: string, workId: string) =>
  ['work-chat-progress', workspaceId, workId] as const;

export function useChatProgress(workspaceId: string, workId: string) {
  return useQuery<ChatProgress[]>({
    queryKey: chatProgressKey(workspaceId, workId),
    queryFn: skipToken,
    gcTime: Infinity,
  }).data;
}

// Поток событий только сообщает, что работа изменилась: событие, открытие и обрыв инвалидируют ключ работы,
// данные приходят из API. Подписка открывается, когда первый вид работы загружен, и читает курсор этого вида.
export function useWorkEvents(
  workspaceId: string,
  workId: string,
  cursor: string | undefined,
): WorkLive {
  const client = useQueryClient();
  const [live, setLive] = useState<WorkLive>('connecting');
  const latestCursor = useRef(cursor);
  const opened = cursor !== undefined;
  useEffect(() => {
    latestCursor.current = cursor;
  }, [cursor]);
  useEffect(() => {
    const after = latestCursor.current;
    if (after === undefined) return;
    const source = new EventSource(
      endpointUrl(streamWorkEvents, {
        params: { workspaceId, workId },
        query: { after },
      }),
    );
    const refresh = () => {
      void client.invalidateQueries({
        queryKey: workKeys.detail(workspaceId, workId),
      });
    };
    source.addEventListener('changed', refresh);
    const progressKey = chatProgressKey(workspaceId, workId);
    source.addEventListener('chat-progress', (event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string')
        return;
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      const delta = chatProgress.safeParse(value).data;
      if (!delta) return;
      client.setQueryData<ChatProgress[]>(progressKey, (previous = []) => [
        ...previous.slice(-511),
        delta,
      ]);
    });
    source.onopen = () => {
      setLive('live');
      refresh();
    };
    source.onerror = () => {
      setLive('reconnecting');
      refresh();
    };
    return () => {
      source.close();
      client.removeQueries({ queryKey: progressKey, exact: true });
    };
  }, [client, workspaceId, workId, opened]);
  return live;
}
