export function nextRunRevision(
  previous: { status: string; revision: number } | null,
  replaceSucceeded = false,
): number | null {
  // Documents retained through the run-history reset can start a new first run.
  if (!previous) return 1;
  return previous.status === 'failed' ||
    (replaceSucceeded && previous.status === 'succeeded')
    ? previous.revision + 1
    : null;
}
