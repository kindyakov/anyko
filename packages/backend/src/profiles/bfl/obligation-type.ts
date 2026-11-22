const creditCard = /(?<!\p{L})кредитн\p{L}*\s+карт\p{L}*/iu;
const loan = /(?<!\p{L})(?:микро)?(?:за[её]м|займ\p{L}*)(?!\p{L})/iu;
const credit =
  /(?:^\s*(?:(?:вид|тип|продукт)\s*:\s*)?кредит\s*[.;]?\s*$|(?<!\p{L})(?:кредитн\p{L}*\s+договор\p{L}*|потребительск\p{L}*\s+кредит\p{L}*|задолженность\s+по\s+кредиту)(?!\p{L}))/iu;

export function isKnownObligationType(value: string | null | undefined) {
  return value === 'Кредит' || value === 'Кредитная карта' || value === 'Заём';
}

export function evidencedObligationType(lines: readonly string[]) {
  const card = lines.some((line) => creditCard.test(line));
  const borrowing = lines.some((line) => loan.test(line));
  if (borrowing && (card || lines.some((line) => credit.test(line))))
    return undefined;
  if (borrowing) return 'Заём';
  if (card) return 'Кредитная карта';
  return lines.some((line) => credit.test(line)) ? 'Кредит' : undefined;
}
