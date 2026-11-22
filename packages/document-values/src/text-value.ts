export function comparableText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}
