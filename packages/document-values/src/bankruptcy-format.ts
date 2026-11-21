import { canonicalMoneyAmount } from './money';

const capitals = (value: string) =>
  /\p{Lu}/u.test(value) && !/\p{Ll}/u.test(value);

export function normalizedPersonName(value: string): string {
  return capitals(value)
    ? value
        .toLowerCase()
        .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase())
    : value;
}

const abbreviations =
  /^(?:АО|ОАО|ООО|ПАО|МФО|МКК|МФК|ЦБ|РФ|ВТБ|МТС|МВД|УМВД|ГУ|УФМС|ФМС|ОВД|РОВД|ОМВД|УВД|ОУФМС)$/iu;
const particles =
  /^(?:по|на|в|и|имени|им|министерства|област(?:ь|и|ью|ей|ям|ями|ях)|обл|край|краю|края|республике|город|гор|улица|ул|проспект|просп|переулок|пер|дом|квартира|кв|корпус|корп|строение|стр|литер|вн|тер|муниципальный|округ|(?:район|р-н)(?:а|у|ом|е|ы|ов|ам|ами|ах)?|площадь|пл|набережная|наб|помещение|пом|комната|ком)$/iu;
const expandedLegalForm =
  /^(?:(?:(?:публичное|непубличное|открытое|закрытое)\s+)?акционерное\s+общество|общество\s+с\s+ограниченной\s+ответственностью)(?:\s+(?:микрокредитная|микрофинансовая)\s+компания)?(?=$|[\s«"(])/iu;

function normalCase(value: string): string {
  return value.replace(/[\p{L}]+(?:-[\p{L}]+)*/gu, (word, offset: number) => {
    const shortLocality =
      /^[гспд]$/iu.test(word) && value[offset + word.length] === '.';
    const lowercase = shortLocality || particles.test(word);
    if (
      !capitals(word) ||
      abbreviations.test(word) ||
      (word.length === 1 && !lowercase)
    )
      return word;
    return lowercase
      ? word.toLowerCase()
      : word
          .split('-')
          .map((part) =>
            abbreviations.test(part) ? part : normalizedPersonName(part),
          )
          .join('-');
  });
}

export function formatBankruptcyMoney(value: string): string {
  const canonical = canonicalMoneyAmount(value);
  if (canonical === undefined) return value;
  const [rubles, kopecks] = canonical.split('.');
  return (
    (rubles ?? '').replace(/\B(?=(?:\d{3})+(?!\d))/gu, ' ') +
    ',' +
    (kopecks ?? '00')
  );
}

export function formatBankruptcyScalar(key: string, value: string): string {
  if (key === 'documentNumber') {
    if (!/^[\d\s№]+$/u.test(value)) return value;
    const digits = value.replace(/[^\d]/gu, '');
    return digits.length === 10
      ? digits.replace(/^(\d{2})(\d{2})(\d{6})$/u, '$1 $2 № $3')
      : value;
  }
  if (['lastName', 'firstName', 'middleName'].includes(key))
    return normalizedPersonName(value);
  if (key === 'birthPlace' || key === 'passportIssuer')
    return normalCase(value);
  return value;
}

const russianQuotes = (value: string) =>
  value.replace(/["„“]([^"“”]+)["“”]/gu, '«$1»');

export function formatCreditorText(value: string): string {
  return russianQuotes(
    normalCase(value).replace(expandedLegalForm, (form) =>
      form.toLowerCase().replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
    ),
  );
}
