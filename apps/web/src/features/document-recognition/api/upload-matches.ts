import { listDocuments } from '@anyko/contracts/documents';

import { callApi } from '@/lib/api/call';

export async function findUploadMatches(
  workspaceId: string,
  checksum: string,
  signal: AbortSignal,
  page = 1,
) {
  const result = await callApi(listDocuments, {
    params: { workspaceId },
    query: { checksum, page, pageSize: uploadMatchPageSize },
    signal,
  });
  // A previous backend version ignores unknown filters. Its response cannot identify matches.
  return result.checksum === checksum
    ? result
    : { items: [], page: 1, pageSize: uploadMatchPageSize, total: 0 };
}

const uploadMatchPageSize = 12;

export async function fileChecksum(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
