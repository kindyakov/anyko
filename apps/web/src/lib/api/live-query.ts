import type { QueryClient } from '@tanstack/react-query';

type LiveTopic =
  | 'work-list'
  | 'work-detail'
  | 'chat'
  | 'history'
  | 'runs'
  | 'recognition-list'
  | 'recognition-status';

export function liveQuery(
  workspaceId: string,
  topic: LiveTopic,
  resourceId?: string,
) {
  return {
    liveWorkspace: workspaceId,
    liveTopic: topic,
    liveResource: resourceId,
  };
}

const queued = new WeakSet<object>();

function liveFilter(
  workspaceId: string,
  topics: readonly LiveTopic[],
  resourceId?: string,
) {
  return ({ meta }: { meta?: Record<string, unknown> | undefined }) =>
    meta?.liveWorkspace === workspaceId &&
    topics.some((topic) => topic === meta.liveTopic) &&
    (resourceId === undefined || meta.liveResource === resourceId);
}

export function resetLiveQueries(
  client: QueryClient,
  workspaceId: string,
  topics: readonly LiveTopic[],
  resourceId: string,
) {
  return client.resetQueries({
    predicate: liveFilter(workspaceId, topics, resourceId),
  });
}

export async function invalidateLiveQueries(
  client: QueryClient,
  workspaceId: string,
  topics: readonly LiveTopic[],
  resourceId?: string,
) {
  const predicate = liveFilter(workspaceId, topics, resourceId);
  const initial = new Set(
    client
      .getQueryCache()
      .findAll({ predicate, type: 'active' })
      .filter(
        (query) =>
          query.state.data === undefined &&
          query.state.fetchStatus === 'fetching' &&
          !queued.has(query),
      ),
  );
  for (const query of initial) queued.add(query);

  try {
    await client.invalidateQueries({ predicate });
  } finally {
    for (const query of initial) queued.delete(query);
  }
  // TanStack Query reuses the first fetch while it has no cached data.
  if (initial.size)
    await client.invalidateQueries({
      predicate: (query) => initial.has(query),
    });
}
