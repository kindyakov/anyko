import { listDocuments } from '@anyko/contracts/documents';

import { callApi } from '@/lib/api/call';

export async function findUploadMatches(
  workspaceId: string,
  checksum: string,
  signal: AbortSignal,
  after?: string,
) {
  const page = await callApi(listDocuments, {
    params: { workspaceId },
    query: { checksum, limit: 12, after },
    signal,
  });
  // A previous backend version ignores unknown filters. Its response cannot identify matches.
  return page.checksum === checksum ? page : { items: [], nextCursor: null };
}

export async function fileChecksum(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
