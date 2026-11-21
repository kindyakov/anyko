'use client';

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  type ChatProgress,
  chatProgress,
  streamWorkEvents,
} from '@anyko/contracts/works';

import { endpointUrl } from '@/lib/api/call';
import { connectLiveEvents, parseLiveEvent } from '@/lib/api/live-events';
import { invalidateLiveQueries, resetLiveQueries } from '@/lib/api/live-query';

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

// A single stream carries work invalidations and chat deltas from the initial work cursor.
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
    const refresh = (topics: Parameters<typeof invalidateLiveQueries>[2]) => {
      void invalidateLiveQueries(client, workspaceId, topics, workId);
    };
    const connection = connectLiveEvents(
      endpointUrl(streamWorkEvents, {
        params: { workspaceId, workId },
        query: { after },
      }),
      () => {
        refresh(['work-detail', 'chat', 'history', 'runs']);
      },
      (online) => {
        setLive(online ? 'live' : 'reconnecting');
      },
    );
    const progressKey = chatProgressKey(workspaceId, workId);
    connection.on('changed', (event) => {
      const change = parseLiveEvent(event);
      if (
        change?.kind === 'sources.deleting' ||
        change?.kind === 'sources.erased' ||
        change?.kind === 'work.deleting'
      ) {
        client.setQueryData<ChatProgress[]>(progressKey, []);
        void resetLiveQueries(
          client,
          workspaceId,
          change.kind === 'work.deleting'
            ? ['work-detail', 'chat', 'history', 'runs']
            : ['chat', 'history', 'runs'],
          workId,
        );
        if (change.kind !== 'work.deleting') refresh(['work-detail']);
        return;
      }
      if (change?.kind === 'chat.checkpoint') refresh(['chat']);
      else if (change?.kind === 'agent.history') refresh(['history']);
      else if (change) {
        if (change.kind.startsWith('processing.'))
          refresh(['work-detail', 'chat', 'history', 'runs']);
        else refresh(['work-detail']);
      }
    });
    connection.on('chat-progress', (event) => {
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
    return () => {
      connection.close();
      client.removeQueries({ queryKey: progressKey, exact: true });
    };
  }, [client, workspaceId, workId, opened]);
  return live;
}
