type MoneyCase = 'nominative' | 'genitive';
type Gender = 'masculine' | 'feminine';

const numbers = {
  nominative: {
    masculine: 'ноль один два три четыре пять шесть семь восемь девять'.split(
      ' ',
    ),
    feminine: 'ноль одна две три четыре пять шесть семь восемь девять'.split(
      ' ',
    ),
    teens:
      'десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать семнадцать восемнадцать девятнадцать'.split(
        ' ',
      ),
    tens: 'двадцать тридцать сорок пятьдесят шестьдесят семьдесят восемьдесят девяносто'.split(
      ' ',
    ),
    hundreds:
      'сто двести триста четыреста пятьсот шестьсот семьсот восемьсот девятьсот'.split(
        ' ',
      ),
  },
  genitive: {
    masculine:
      'нуля одного двух трёх четырёх пяти шести семи восьми девяти'.split(' '),
    feminine:
      'нуля одной двух трёх четырёх пяти шести семи восьми девяти'.split(' '),
    teens:
      'десяти одиннадцати двенадцати тринадцати четырнадцати пятнадцати шестнадцати семнадцати восемнадцати девятнадцати'.split(
        ' ',
      ),
    tens: 'двадцати тридцати сорока пятидесяти шестидесяти семидесяти восьмидесяти девяноста'.split(
      ' ',
    ),
    hundreds:
      'ста двухсот трёхсот четырёхсот пятисот шестисот семисот восьмисот девятисот'.split(
        ' ',
      ),
  },
};
const scales = [
  ['тысяча', 'тысячи', 'тысяч'],
  ['миллион', 'миллиона', 'миллионов'],
  ['миллиард', 'миллиарда', 'миллиардов'],
  ['триллион', 'триллиона', 'триллионов'],
  ['квадриллион', 'квадриллиона', 'квадриллионов'],
  ['квинтиллион', 'квинтиллиона', 'квинтиллионов'],
] as const;
const rubles = ['рубль', 'рубля', 'рублей'] as const;
const kopecks = ['копейка', 'копейки', 'копеек'] as const;
const maxRubles = 1000n ** BigInt(scales.length + 1);

export const moneyPlaceholders = [
  'RUB_DECIMAL',
  'RUB_WORDS',
  'RUB_GENITIVE_WORDS',
] as const;

const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/−/g, '-')
    .trim()
    .replace(/\s+/g, ' ');
const grammar = new Map<string, number>();
for (const words of Object.values(numbers)) {
  for (const [list, offset, step] of [
    [words.masculine, 0, 1],
    [words.feminine, 0, 1],
    [words.teens, 10, 1],
    [words.tens, 20, 10],
    [words.hundreds, 100, 100],
  ] as const) {
    list.forEach((word, index) => {
      grammar.set(normalize(word), offset + index * step);
    });
  }
}
const scaleByWord = new Map<string, number>();
scales.forEach((forms, index) => {
  forms.forEach((word) => {
    scaleByWord.set(word, index + 1);
  });
});
// Capture an entire written amount before validating grouping or precision.
const numeric = '[0-9]+(?: [0-9]+)*(?:[.,][0-9]+)?';
const word = [...grammar.keys(), ...scaleByWord.keys()]
  .sort((a, b) => b.length - a.length)
  .join('|');
const count = `(?:${numeric}|(?:${word})(?: (?:${word}))*)`;
const ruble = '(?:руб(?:ль|ля|лей|\\.)?|р\\.|₽|rub)(?![а-яa-z])';
const kopeck = '(?:коп(?:ейка|ейку|ейки|еек|\\.)?|к\\.)(?![а-яa-z])';
const sign = '(?:минус +|[+-] *)?';
const currency = `(${sign})(${count}) *(?:российск(?:ий|их|ого) )?${ruble}(?:,? *(?:и )?(${count}) *${kopeck})?`;
const signedCurrency = new RegExp(`^${currency}\\.?$`, 'u');
const plain =
  /^([+-]?) *([0-9]+|[0-9]{1,3}(?: [0-9]{3})+)(?:[.,]([0-9]{1,2}))?$/u;
const otherCurrency =
  '(?:usd|eur|gbp|cny|kzt|byn|uah|доллар[а-я]*|долл\\.?|евро|фунт[а-я]*|юан[а-я]*|тенге|грив[а-я]*|[$€£¥])(?![а-яa-z])';
// Claim the whole denominated fragment first. The stricter parser decides
// whether it describes an exact amount in rubles.
const majorUnit = `(?:руб[а-я]*\\.?|р\\.|₽|rub|${otherCurrency})(?![а-яa-z])`;
const minorUnit =
  '(?<![а-яa-z])(?:коп(?:е[а-я]*)?\\.?|к\\.|цент[а-я]*|пенс[а-я]*|cents?|pence)(?![а-яa-z])';
const qualifier = '(?:[а-яa-z-]+(?:\\. *| +)){0,2}';
const annotation = '\\([^()|;]{0,80}\\)';
const amountStart = '(?<![а-яa-z0-9.,+-])';
const majorComponent = `${amountStart}(?:${sign}${count} *(?:${annotation} *)?${qualifier}${majorUnit}|${otherCurrency} *${sign}${numeric})`;
const currencyInText = new RegExp(
  `(${majorComponent})|${amountStart}${sign}${count} *(?:${annotation} *)?${qualifier}${minorUnit}`,
  'gu',
);
const majorAt = new RegExp(majorComponent, 'uy');
const minorAt = new RegExp(minorUnit, 'uy');
const bareAmount = new RegExp(
  `${amountStart}${sign}${numeric}(?![а-яa-z0-9]|[.,][0-9])`,
  'gu',
);

function parseNumeral(text: string): bigint | undefined {
  if (/^[0-9]+$/u.test(text)) return BigInt(text);
  if (text === 'ноль' || text === 'нуля') return 0n;
  let result = 0n;
  let group = 0;
  let previousRank = 3;
  let previousScale = scales.length + 1;
  for (const token of text.split(' ')) {
    const scale = scaleByWord.get(token);
    if (scale !== undefined) {
      if (group === 0 || scale >= previousScale) return;
      result += BigInt(group) * 1000n ** BigInt(scale);
      previousScale = scale;
      previousRank = 3;
      group = 0;
      continue;
    }
    const digit = grammar.get(token);
    if (!digit) return;
    const rank = digit >= 100 ? 2 : digit >= 20 ? 1 : 0;
    if (rank >= previousRank || (previousRank === 1 && digit >= 10)) return;
    group += digit;
    previousRank = rank;
  }
  return result + BigInt(group);
}

function parseAmount(value: string): bigint | undefined {
  const text = normalize(value);
  const match = plain.exec(text);
  if (match?.[2]) {
    const whole = BigInt(match[2].replaceAll(' ', ''));
    if (whole >= maxRubles) return;
    return (
      (match[1] === '-' ? -1n : 1n) *
      (whole * 100n + BigInt((match[3] ?? '').padEnd(2, '0')))
    );
  }
  const explicit = signedCurrency.exec(text);
  if (!explicit?.[2]) return;
  const hasKopecks = explicit[3] !== undefined;
  const decimal = plain.exec(explicit[2]);
  const negative = explicit[1]?.startsWith('-') || explicit[1] === 'минус ';
  if (decimal?.[3]) {
    if (hasKopecks) return;
    return parseAmount((negative ? '-' : '') + explicit[2]);
  }
  const whole = parseNumeral(decimal?.[2]?.replaceAll(' ', '') ?? explicit[2]);
  const fraction = hasKopecks ? parseNumeral(explicit[3] ?? '') : 0n;
  if (
    whole === undefined ||
    whole >= maxRubles ||
    fraction === undefined ||
    fraction >= 100n
  )
    return;
  return (negative ? -1n : 1n) * (whole * 100n + fraction);
}

/** Exact decimal storage and comparison, down to the last kopeck. */
export function canonicalMoneyAmount(value: string): string | undefined {
  const amount = parseAmount(value);
  if (amount === undefined) return;
  const magnitude = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${String(magnitude / 100n)}.${String(magnitude % 100n).padStart(2, '0')}`;
}

// Stop at a new amount or column outside parentheses. A repeated amount in
// an annotation belongs to the same fragment, as does a nearby minor unit.
function denominatedEnd(text: string, start: number): number {
  const limit = Math.min(text.length, start + 80);
  const annotationStart = text[start] === ' ' ? start + 1 : start;
  let annotationEnd = start;
  let minorEnd = start;
  let depth = 0;
  for (let index = start; index < limit; index++) {
    const character = text.charAt(index);
    if (';|!?'.includes(character)) break;

    majorAt.lastIndex = index;
    if (depth === 0 && majorAt.test(text)) break;
    minorAt.lastIndex = index;
    if (minorAt.test(text)) {
      if (depth === 0) return minorAt.lastIndex;
      minorEnd = minorAt.lastIndex;
    }

    if (character === '(') depth++;
    if (character === ')' && depth > 0) {
      depth--;
      if (depth > 0) continue;
      if (minorEnd > start) return index + 1;
      if (text[annotationStart] === '(' && annotationEnd === start)
        annotationEnd = index + 1;
    }
  }
  return Math.max(annotationEnd, minorEnd);
}

export function moneyAmountsInText(text: string): string[] {
  const normalized = normalize(text.replace(/[\r\n]+/gu, ' | '));
  const explicit: string[] = [];
  const remainder: string[] = [];
  let cursor = 0;
  for (const match of normalized.matchAll(currencyInText)) {
    if (match.index < cursor) continue;
    remainder.push(normalized.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[1]) cursor = denominatedEnd(normalized, cursor);
    const canonical = canonicalMoneyAmount(
      normalized.slice(match.index, cursor),
    );
    if (canonical !== undefined) explicit.push(canonical);
  }
  remainder.push(normalized.slice(cursor));
  return [
    ...explicit,
    ...remainder.flatMap((fragment) =>
      (fragment.match(bareAmount) ?? []).flatMap(
        (amount) =>
          canonicalMoneyAmount(amount.replace(/^минус */u, '-')) ?? [],
      ),
    ),
  ];
}

function noun(
  count: number,
  forms: readonly [string, string, string],
  style: MoneyCase,
) {
  const units = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  if (style === 'genitive') return units === 1 && !teen ? forms[1] : forms[2];
  return teen || units === 0 || units >= 5
    ? forms[2]
    : units === 1
      ? forms[0]
      : forms[1];
}

function threeDigits(value: number, gender: Gender, style: MoneyCase) {
  const words = numbers[style];
  const remainder = value % 100;
  return [
    words.hundreds[Math.floor(value / 100) - 1],
    remainder >= 10 && remainder <= 19
      ? words.teens[remainder - 10]
      : words.tens[Math.floor(remainder / 10) - 2],
    (remainder < 10 || remainder >= 20) && remainder % 10 > 0
      ? words[gender][remainder % 10]
      : undefined,
  ].filter(Boolean);
}

function cardinal(value: bigint, gender: Gender, style: MoneyCase) {
  if (value === 0n) return numbers[style][gender][0];
  const groups: string[] = [];
  for (let index = 0; value > 0n; index++, value /= 1000n) {
    const group = Number(value % 1000n);
    if (group === 0) continue;
    const words = threeDigits(
      group,
      index === 1 ? 'feminine' : index > 1 ? 'masculine' : gender,
      style,
    );
    const scale = scales[index - 1];
    if (scale) words.push(noun(group, scale, style));
    groups.unshift(words.join(' '));
  }
  return groups.join(' ');
}

export function formatMoneyAmount(value: string, placeholder: string): string {
  if (placeholder === 'RUB_DECIMAL')
    return canonicalMoneyAmount(value)?.replace('.', ',') ?? value;
  if (placeholder !== 'RUB_WORDS' && placeholder !== 'RUB_GENITIVE_WORDS')
    return value;
  const amount = parseAmount(value);
  if (amount === undefined) return value;
  const style: MoneyCase =
    placeholder === 'RUB_WORDS' ? 'nominative' : 'genitive';
  const magnitude = amount < 0n ? -amount : amount;
  const whole = magnitude / 100n;
  const fraction = magnitude % 100n;
  return [
    amount < 0n ? 'минус' : '',
    cardinal(whole, 'masculine', style),
    noun(Number(whole % 100n), rubles, style),
    cardinal(fraction, 'feminine', style),
    noun(Number(fraction), kopecks, style),
  ]
    .filter(Boolean)
    .join(' ');
}
