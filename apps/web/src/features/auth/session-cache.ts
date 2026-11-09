import type { QueryClient } from '@tanstack/react-query';

export function expireSession(client: QueryClient) {
  void client.cancelQueries();
  client.setQueryData(['session'], null);
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== 'session',
  });
  client.getMutationCache().clear();
}
