export function errorReference(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('digest' in error)) return undefined;
  const digest = error.digest;
  return typeof digest === 'string' && /^\d{1,14}(?:@E\d{1,6})?$/u.test(digest)
    ? digest
    : undefined;
}
