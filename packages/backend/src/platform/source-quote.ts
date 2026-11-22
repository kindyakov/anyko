export function literalSourceQuote(source: string | undefined, quote: string) {
  if (!quote.trim() || source === undefined) return undefined;
  if (source.includes(quote)) return quote;
  const pattern = quote.trim().split(/\s+/u).map(RegExp.escape).join('\\s+');
  const match = new RegExp(pattern, 'u').exec(source)?.[0];
  return match && match.length <= 2000 ? match : undefined;
}
