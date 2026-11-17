import { queryOptions } from '@tanstack/react-query';

import { documentResultSchema } from '@anyko/contracts/documents';

import { requestApi } from '@/lib/api/client';

import { documentKeys } from './keys';

export function documentResultQueryOptions(
  workspaceId: string,
  documentId: string,
) {
  return queryOptions({
    queryKey: documentKeys.result(workspaceId, documentId),
    queryFn: ({ signal }) =>
      requestApi(
        `/documents/${encodeURIComponent(documentId)}/result`,
        documentResultSchema,
        { signal },
      ),
  });
}
