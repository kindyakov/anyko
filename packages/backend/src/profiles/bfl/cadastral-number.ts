export function canonicalCadastralNumber(value: string) {
  const compact = value.replace(/\s+/gu, '');
  return /^\d{1,20}(?::\d{1,20}){3}$/u.test(compact) ? compact : undefined;
}

export function cadastralNumbersIn(text: string) {
  return [
    ...text.matchAll(
      /(?<![\d:])\d{1,20}(?:[ \t]*:[ \t]*\d{1,20}){3}(?![\d:])/gu,
    ),
  ].flatMap(([number]) => canonicalCadastralNumber(number) ?? []);
}

export function cadastralNumberCitations(text: string) {
  return [
    ...text.matchAll(
      /(?:^|[\n.;|])[ \t|]*(?<quote>кадастровый[ \t]+номер(?:[ \t]+объекта(?:[ \t]+недвижимости)?)?[ \t:|–—-]+(?<number>\d{1,20}(?:[ \t]*:[ \t]*\d{1,20}){3})(?![\d:]))/giu,
    ),
  ].flatMap((match) => {
    const { number, quote } = match.groups ?? {};
    const value = number && canonicalCadastralNumber(number);
    return value && quote ? [{ value, quote, offset: match.index }] : [];
  });
}
