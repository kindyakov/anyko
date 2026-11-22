import { submittedAttachmentRows } from './attachments';
import { formatBankruptcyMoney, formatCreditorText } from './bankruptcy-format';
import {
  datedBankruptcyPackage,
  statementDebtorGender,
} from './bankruptcy-statement';
import { formatCalendarDate } from './calendar-date';
import { canonicalMoneyAmount, formatMoneyAmount } from './money';
import { groupCreditorObligations, obligationAmounts } from './obligations';

type Row = Record<string, string | null>;
type Values = Partial<Record<string, string | Row[] | null>>;

const statementTemplates = new Set([
  'bfl-statement-v9',
  'bfl-statement-v10',
  'bfl-statement-v11',
]);

export const bflLayoutPackage = 'bfl-bankruptcy-v14';
export const bflLayoutTemplates = {
  'bfl-statement-v12': 'bfl-statement-v11',
  'bfl-inventory-v3': 'bfl-inventory-v2',
  'bfl-creditors-v4': 'bfl-creditors-v3',
} as const;
export function bflContentTemplate(version: string): string {
  return Object.hasOwn(bflLayoutTemplates, version)
    ? bflLayoutTemplates[version as keyof typeof bflLayoutTemplates]
    : version;
}

export const revisedStatementTemplate = (version: string | undefined) =>
  version !== undefined && statementTemplates.has(bflContentTemplate(version));

export const revisedBankruptcyPackages = [
  'bfl-bankruptcy-v9',
  'bfl-bankruptcy-v10',
  'bfl-bankruptcy-v11',
  'bfl-bankruptcy-v12',
  'bfl-bankruptcy-v13',
] as const;
const datedPackages = new Set<string>([
  datedBankruptcyPackage,
  ...revisedBankruptcyPackages,
  bflLayoutPackage,
]);
export const isDatedBankruptcyPackage = (version: string) =>
  datedPackages.has(version);

function text(values: Values, field: string) {
  const value = values[field];
  return typeof value === 'string' ? value.trim() : '';
}

function addressPart(values: Values, field: string, prefix: string) {
  const value = text(values, field);
  return value && (/^\d/u.test(value) ? prefix + value : value);
}

function statementAttachmentClauses(values: Values) {
  const attachments = submittedAttachmentRows(values.submittedAttachments);
  return [
    {
      included: attachments.some(
        ({ documentId }) => documentId === 'package:creditors',
      ),
      label: 'список кредиторов',
      text: 'Список своих кредиторов и должников по форме, утвержденной Приказом Минэкономразвития России от 05.08.2015 № 530, прилагаю.',
    },
    {
      included: attachments.some(
        ({ category }) => category === 'debtCertificate',
      ),
      label: 'справки о задолженности',
      text: 'Документы, подтверждающие наличие обязательств перед Кредиторами, прилагаю.',
    },
    {
      included: attachments.some(
        ({ category }) => category === 'pensionAccount',
      ),
      label: 'сведения о лицевом счёте',
      text: 'Справку о состоянии моего индивидуального лицевого счета застрахованного лица в системе обязательного пенсионного страхования прилагаю.',
    },
  ] as const;
}

export function omittedStatementAttachments(
  version: string | undefined,
  values: Values,
) {
  return revisedStatementTemplate(version)
    ? statementAttachmentClauses(values)
        .filter(({ included }) => !included)
        .map(({ label }) => label)
    : [];
}

export function statementLayout(version: string | undefined, values: Values) {
  if (!revisedStatementTemplate(version)) return {};
  const feminine = statementDebtorGender(values) === 'female';
  const citizenship = text(values, 'citizenship');
  const russian = /^(?:российская федерация|россии|рф)$/iu.test(citizenship);
  const [creditors, debtCertificates, pensionAccount] =
    statementAttachmentClauses(values);
  const debtorAddress = [
    ...['postalCode', 'region', 'district', 'city', 'locality', 'street'].map(
      (field) => text(values, field),
    ),
    addressPart(values, 'house', 'д. '),
    addressPart(values, 'building', 'корп. '),
    addressPart(values, 'apartment', 'кв. '),
  ]
    .filter(Boolean)
    .join(', ');
  return {
    debtorAddress: debtorAddress || '[не заполнено]',
    debtorCitizenship: russian
      ? 'гражданин Российской Федерации'
      : 'гражданство: ' + (citizenship || '[не заполнено]'),
    requestCitizenship: russian
      ? 'гражданина Российской Федерации'
      : 'гражданство: ' + (citizenship || '[не заполнено]'),
    debtorRegistration: feminine
      ? 'зарегистрирована и проживаю по адресу'
      : 'зарегистрирован и проживаю по адресу',
    requestFullRegistration: feminine
      ? 'зарегистрированную и проживающую по адресу'
      : 'зарегистрированного и проживающего по адресу',
    statementAttachmentReferences: [creditors, debtCertificates, pensionAccount]
      .flatMap(({ included, text }) => (included ? [text] : []))
      .join('\n'),
    // Wording of the lawyer's sample, confirmed for every statement (#70).
    statementGroundsText: [
      'У меня имеются обстоятельства, очевидно свидетельствующие о том, что я не в состоянии удовлетворить в полном объеме требования Кредитора по денежным обязательствам, у меня имеются признаки неплатежеспособности, установленные п. 3 ст. 213.6 Федерального закона от 26.10.2002 г. № 127-ФЗ «О несостоятельности (банкротстве)», а именно:',
      `Я ${feminine ? 'прекратила' : 'прекратил'} расчеты с Кредиторами, то есть ${feminine ? 'перестала' : 'перестал'} исполнять денежные обязательства, срок исполнения которых наступил;`,
      'Более чем десять процентов совокупного размера денежных обязательств, которые имеются у меня и срок исполнения которых наступил, не исполнены мной в течение более чем трёх месяцев со дня, когда такие обязательства должны быть исполнены;',
      'Размер моей задолженности превышает стоимость моего имущества, в том числе право требования.',
    ].join('\n'),
    statementBalanceConclusion:
      'Как видно из приведенного выше, общий (совокупный) размер моих обязательств превышает общую стоимость имущества.',
  };
}

export function filingMoneyWords(value: string) {
  const amount = canonicalMoneyAmount(value);
  const words = formatMoneyAmount(value, 'RUB_WORDS');
  return amount?.endsWith('.00') ? words.replace(/ ноль копеек$/u, '') : words;
}

export function withFilingDateSuffix(value: string) {
  return value.replace(
    /(\d{2}\.\d{2}\.\d{4})(?!\d|\s*(?:г\.|года|г\.\s*р\.))/gu,
    '$1 г.',
  );
}

export function contractNarrative(
  row: Row,
  style: 'statement' | 'creditors' = 'statement',
) {
  const kind = row.type?.trim().toLowerCase();
  const contract =
    kind === 'заём' || kind === 'заем'
      ? 'по договору займа'
      : kind === 'кредитная карта'
        ? 'по договору кредитной карты'
        : kind === 'кредит' || kind === 'кредитный договор'
          ? 'по кредитному договору'
          : 'по договору';
  const date =
    row.contractDate && formatCalendarDate(row.contractDate, 'DD.MM.YYYY г.');
  const amount = canonicalMoneyAmount(row.amount ?? '');
  const number = row.contractNumber?.replace(/^№\s*/u, '');
  const details = number
    ? [`№ ${number}`, date && `от ${date}`].filter(Boolean).join(' ')
    : row.basis && withFilingDateSuffix(row.basis);
  const amountText = amount ? contractAmount(amount, style) : '[не заполнено]';
  const proof = row.proof?.trim().replace(/[.;]+$/u, '');
  const basis = proof
    ?.replace(/^справка(?=\s|$)/iu, 'справки')
    .replace(/^выписка(?=\s|$)/iu, 'выписки');
  const confirmation =
    basis && basis !== proof
      ? `, исходя из ${withFilingDateSuffix(basis)}`
      : `, подтверждение: ${withFilingDateSuffix(proof || '[не заполнено]')}`;
  return `${contract} ${details || '[не заполнено]'} в размере ${amountText}${confirmation}`;
}

function contractAmount(amount: string, style: 'statement' | 'creditors') {
  const whole = amount.endsWith('.00');
  const digits = formatBankruptcyMoney(amount);
  const number = whole ? digits.slice(0, -3) : digits;
  if (style === 'statement')
    return `${number} руб. (${filingMoneyWords(amount)})`;
  if (!whole) return number + ' руб.';
  const rubles = BigInt(amount.split('.')[0] ?? '0');
  return `${number} ${rubles % 10n === 1n && rubles % 100n !== 11n ? 'рубля' : 'рублей'}`;
}

export function statementDebtNarratives(
  version: string | undefined,
  values: Values,
) {
  if (version !== 'bfl-statement-v10' && version !== 'bfl-statement-v11')
    return undefined;
  const { debts, businessDebts } = obligationAmounts(
    values.debts,
    values.businessDebts,
    true,
  );
  const groups = groupCreditorObligations([
    ...(debts ?? []),
    ...(businessDebts ?? []),
  ]);
  return groups.flatMap(([first, ...other]) =>
    first
      ? [
          {
            description: `Неспособность удовлетворить требования кредитора ${formatCreditorText(first.creditorShortName || first.name || '[не заполнено]')} ${[first, ...other].map((row) => contractNarrative(row)).join('; ')};`,
          },
        ]
      : [],
  );
}
