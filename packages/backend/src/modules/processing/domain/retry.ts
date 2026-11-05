export function nextRunRevision(
  previous: { status: string; revision: number } | null,
): number | null {
  return previous?.status === 'failed' ? previous.revision + 1 : null;
}
