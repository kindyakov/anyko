export function documentLockKey(
  workspaceId: string,
  documentId: string,
): string {
  return `document:${workspaceId}:${documentId}`;
}
