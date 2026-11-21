const months = [
  ['январь', 'января'],
  ['февраль', 'февраля'],
  ['март', 'марта'],
  ['апрель', 'апреля'],
  ['май', 'мая'],
  ['июнь', 'июня'],
  ['июль', 'июля'],
  ['август', 'августа'],
  ['сентябрь', 'сентября'],
  ['октябрь', 'октября'],
  ['ноябрь', 'ноября'],
  ['декабрь', 'декабря'],
];

const monthNames = months.flat().join('|');
const localDate = String.raw`(\d{1,2})([./:])(\d{1,2})\2(\d{4})`;
const numericDate = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const writtenDate = String.raw`(\d{1,2})\s+(${monthNames})\s+(\d{4})(?:\s+(?:года|г\.))?`;
const written = new RegExp(`^${writtenDate}$`, 'iu');
const local = new RegExp(`^${localDate}$`);
const dateInWords = 'D_WORDS MMMM YYYY_WORDS года';
const dateInGenitiveWords = 'D_GENITIVE_WORDS MMMM YYYY_WORDS года';

export const calendarDatePlaceholders = [
  'DD.MM.YYYY',
  'DD.MM.YYYY г.',
  'DD/MM/YYYY',
  'DD:MM:YYYY',
  'YYYY-MM-DD',
  'D MMMM YYYY',
  'D MMMM YYYY года',
  'D MMMM YYYY г.',
  dateInWords,
  dateInGenitiveWords,
] as const;

type CalendarDate = { day: string; month: string; year: string };

function parseCalendarDate(value: string): CalendarDate | undefined {
  const text = value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/\s+(?:года|г\.)$/, '');
  const iso = numericDate.exec(text);
  const digits = local.exec(text);
  const words = written.exec(text);
  const day = (iso?.[3] ?? digits?.[1] ?? words?.[1])?.padStart(2, '0');
  const year = iso?.[1] ?? digits?.[4] ?? words?.[3];
  const month = (
    iso?.[2] ??
    digits?.[3] ??
    String(months.findIndex((names) => names.includes(words?.[2] ?? '')) + 1)
  ).padStart(2, '0');
  if (!day || !year || year === '0000') return;
  const date = `${year}-${month}-${day}`;
  const calendar = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(calendar.valueOf()) ||
    !calendar.toISOString().startsWith(date)
  )
    return;
  return { day, month, year };
}

/** Стабильная запись календарной даты для хранения и сравнения сведений. */
export function canonicalCalendarDate(value: string): string | undefined {
  const date = parseCalendarDate(value);
  if (date) return `${date.day}.${date.month}.${date.year}`;
}

export function formatCalendarDate(value: string, placeholder: string): string {
  if (!calendarDatePlaceholders.some((format) => format === placeholder))
    return value;
  const date = parseCalendarDate(value);
  if (!date) return value;
  const month = months[Number(date.month) - 1]?.[1] ?? '';
  if (placeholder === dateInWords || placeholder === dateInGenitiveWords) {
    const day = ordinalGenitive(Number(date.day));
    const dayText =
      placeholder === dateInWords
        ? day.replace(/ого$/, 'ое').replace(/его$/, 'е')
        : day;
    return `${dayText} ${month} ${ordinalGenitive(Number(date.year))} года`;
  }
  const tokens: Record<string, string> = {
    DD: date.day,
    D: String(Number(date.day)),
    MM: date.month,
    MMMM: month,
    YYYY: date.year,
  };
  return placeholder.replace(
    /MMMM|MM|DD|D|YYYY/g,
    (token) => tokens[token] ?? token,
  );
}

const unitOrdinals = [
  '',
  'первого',
  'второго',
  'третьего',
  'четвёртого',
  'пятого',
  'шестого',
  'седьмого',
  'восьмого',
  'девятого',
  'десятого',
  'одиннадцатого',
  'двенадцатого',
  'тринадцатого',
  'четырнадцатого',
  'пятнадцатого',
  'шестнадцатого',
  'семнадцатого',
  'восемнадцатого',
  'девятнадцатого',
];
const tens = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const tensOrdinals = [
  '',
  '',
  'двадцатого',
  'тридцатого',
  'сорокового',
  'пятидесятого',
  'шестидесятого',
  'семидесятого',
  'восьмидесятого',
  'девяностого',
];
const hundreds = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];
const thousands = [
  '',
  'тысяча',
  'две тысячи',
  'три тысячи',
  'четыре тысячи',
  'пять тысяч',
  'шесть тысяч',
  'семь тысяч',
  'восемь тысяч',
  'девять тысяч',
];
const ordinalStems = [
  '',
  '',
  'двух',
  'трёх',
  'четырёх',
  'пяти',
  'шести',
  'семи',
  'восьми',
  'девяти',
];

// In a compound ordinal only its last part takes the case ending.
function ordinalGenitive(number: number): string {
  const thousand = Math.floor(number / 1000);
  const hundred = Math.floor((number % 1000) / 100);
  const remainder = number % 100;
  const parts = [];
  if (number % 1000 === 0) return `${ordinalStems[thousand] ?? ''}тысячного`;
  if (thousand) parts.push(thousands[thousand]);
  if (remainder === 0) {
    parts.push(`${ordinalStems[hundred] ?? ''}сотого`);
  } else {
    if (hundred) parts.push(hundreds[hundred]);
    const ten = Math.floor(remainder / 10);
    if (remainder < 20) {
      parts.push(unitOrdinals[remainder]);
    } else if (remainder % 10 === 0) {
      parts.push(tensOrdinals[ten]);
    } else {
      parts.push(tens[ten], unitOrdinals[remainder % 10]);
    }
  }
  return parts.join(' ');
}

export function datesInText(text: string): string[] {
  const dates = new RegExp(
    String.raw`(?<!\d)(?:\d{4}-\d{2}-\d{2}|${localDate})(?!\d)|(?<!\d)${writtenDate}(?![\p{L}\d])`,
    'giu',
  );
  return text.normalize('NFKC').match(dates) ?? [];
}
