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
    const detail = () => {
      void client.invalidateQueries({
        queryKey: workKeys.detail(workspaceId, workId),
      });
    };
    const chat = () => {
      const queryKey = ['work-chat', workspaceId, workId];
      // An initial GET may already be in flight when the checkpoint commits.
      const initialFetch =
        client.getQueryState(queryKey)?.data === undefined &&
        client.getQueryState(queryKey)?.fetchStatus === 'fetching';
      const refresh = client.invalidateQueries({ queryKey });
      if (initialFetch)
        void refresh.then(() => client.invalidateQueries({ queryKey }));
    };
    const history = () => {
      void client.invalidateQueries({
        queryKey: ['work-agent-history', workspaceId, workId],
      });
    };
    const runs = () => {
      void client.invalidateQueries({
        queryKey: ['work-analysis-runs', workspaceId, workId],
      });
    };
    const connection = connectLiveEvents(
      endpointUrl(streamWorkEvents, {
        params: { workspaceId, workId },
        query: { after },
      }),
      () => {
        detail();
        chat();
        history();
        runs();
      },
      (online) => {
        setLive(online ? 'live' : 'reconnecting');
      },
    );
    connection.on('changed', (event) => {
      const change = parseLiveEvent(event);
      if (change?.kind === 'chat.checkpoint') chat();
      else if (change?.kind === 'agent.history') history();
      else if (change) {
        detail();
        if (
          change.kind.startsWith('processing.') ||
          change.kind === 'sources.erased'
        ) {
          chat();
          history();
          runs();
        }
      }
    });
    const progressKey = chatProgressKey(workspaceId, workId);
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
