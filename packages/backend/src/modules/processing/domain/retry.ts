export function nextRunRevision(
  previous: { status: string; revision: number } | null,
): number | null {
  // Documents retained through the run-history reset can start a new first run.
  if (!previous) return 1;
  return previous.status === 'failed' ? previous.revision + 1 : null;
}
