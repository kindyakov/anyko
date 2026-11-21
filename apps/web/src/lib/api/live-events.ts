'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { streamWorkspaceEvents } from '@anyko/contracts/works';

import { endpointUrl } from './call';

const eventSchema = z.object({
  kind: z.string(),
  documentId: z.string().optional(),
});
const fallbackMs = 30000;

export function parseLiveEvent(event: Event) {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string')
    return;
  try {
    return eventSchema.safeParse(JSON.parse(event.data)).data;
  } catch {
    return undefined;
  }
}

export function connectLiveEvents(
  url: string,
  refresh: () => void,
  status?: (live: boolean) => void,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let source: EventSource | undefined;
  let lastEventId = '';
  const handlers = new Map<string, (event: Event) => void>();
  const degraded = () => {
    status?.(false);
    timer ??= setInterval(() => {
      refresh();
      if (source && source.readyState === EventSource.CLOSED) start();
    }, fallbackMs);
  };
  const ready = () => {
    clearInterval(timer);
    timer = undefined;
    status?.(true);
    refresh();
  };
  const start = () => {
    if (typeof EventSource === 'undefined') {
      degraded();
      return;
    }
    const address = new URL(url, 'http://localhost');
    if (lastEventId && address.searchParams.has('after'))
      address.searchParams.set('after', lastEventId);
    const next = new EventSource(address.pathname + address.search);
    next.onopen = ready;
    next.onerror = degraded;
    next.addEventListener('ready', ready);
    next.addEventListener('degraded', degraded);
    for (const [type, handle] of handlers) next.addEventListener(type, handle);
    source = next;
  };
  start();
  return {
    on(type: string, receive: (event: Event) => void) {
      const handle = (event: Event) => {
        if (event instanceof MessageEvent && event.lastEventId)
          lastEventId = event.lastEventId;
        receive(event);
      };
      handlers.set(type, handle);
      source?.addEventListener(type, handle);
    },
    close: () => {
      source?.close();
      clearInterval(timer);
    },
  };
}

const subscriptions = new WeakMap<
  QueryClient,
  Map<string, { count: number; close(): void }>
>();

export function useWorkspaceEvents(workspaceId: string) {
  const client = useQueryClient();
  useEffect(() => {
    let streams = subscriptions.get(client);
    if (!streams) {
      streams = new Map();
      subscriptions.set(client, streams);
    }
    let shared = streams.get(workspaceId);
    if (!shared) {
      const works = () => {
        void client.invalidateQueries({
          queryKey: ['works', workspaceId, 'list'],
        });
        void client.invalidateQueries({
          queryKey: ['works', workspaceId, 'deletion'],
        });
        void client.invalidateQueries({
          queryKey: ['documents', workspaceId, 'deletion-impact'],
        });
      };
      const documents = (documentId?: string) => {
        void client.invalidateQueries({
          queryKey: ['documents', workspaceId, 'list'],
        });
        void client.invalidateQueries({
          queryKey: ['upload-matches', workspaceId],
        });
        void client.invalidateQueries({
          queryKey: documentId
            ? ['documents', workspaceId, 'status', documentId]
            : ['documents', workspaceId, 'status'],
        });
      };
      const connection = connectLiveEvents(
        endpointUrl(streamWorkspaceEvents, { params: { workspaceId } }),
        () => {
          works();
          documents();
        },
      );
      connection.on('changed', (event) => {
        const change = parseLiveEvent(event);
        if (change?.kind === 'work-list') works();
        if (change?.kind === 'recognition') documents(change.documentId);
      });
      shared = { count: 0, close: connection.close };
      streams.set(workspaceId, shared);
    }
    shared.count++;
    return () => {
      if (--shared.count === 0) {
        shared.close();
        streams.delete(workspaceId);
      }
    };
  }, [client, workspaceId]);
}
