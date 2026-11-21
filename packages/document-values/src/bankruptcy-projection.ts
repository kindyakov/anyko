import { hasSubmittedAttachments } from './attachments';
import { formatBankruptcyMoney, formatCreditorText } from './bankruptcy-format';
import {
  bankruptcyStatement,
  statementDebtorGender,
  statementNameParts,
} from './bankruptcy-statement';
import type { assessEmployment } from './employment';
import { canonicalMoneyAmount, formatMoneyAmount } from './money';
import {
  groupCreditorObligations,
  obligationAmounts,
  obligationTemplate,
} from './obligations';
import { contractNarrative, filingMoneyWords } from './statement-layout';
import { comparableText } from './text-value';

type Row = Record<string, string | null>;
type Value = string | Row[] | null | undefined;
type Values = Readonly<Record<string, Value>>;

export function usesBankruptcyProjection(
  version: string | undefined,
  fields: readonly { key: string }[] = [],
): boolean {
  return (
    bankruptcyStatement(version) ||
    version === 'bfl-inventory-v2' ||
    version === 'bfl-creditors-v3' ||
    (!!version && version.startsWith('bfl-') && hasSubmittedAttachments(fields))
  );
}

export function projectBankruptcyCollections(
  version: string,
  values: Values,
  modern: boolean,
) {
  if (!obligationTemplate(version)) return null;
  const { debts, businessDebts, creditorHeaders, total, totalWords } =
    obligationAmounts(values.debts, values.businessDebts, modern);
  if (!modern)
    return { debts, businessDebts, creditorHeaders, total, totalWords };
  const isCreditorList = version.startsWith('bfl-creditors-');
  const grouped = version === 'bfl-creditors-v3';
  const rows = (entries: Row[] | null): Row[] => {
    if (isCreditorList && !entries?.length)
      return [
        Object.fromEntries(
          [
            'rowNumber',
            'type',
            'name',
            'address',
            'ogrn',
            'inn',
            'basis',
            'amount',
            'arrears',
            'penalties',
            'proof',
          ].map((key) => [
            key,
            entries === null && key === 'type' ? '[не заполнено]' : '-',
          ]),
        ),
      ];
    const projected = grouped && entries ? groupDebtRows(entries) : entries;
    return (
      projected?.map((row) => ({
        ...formatCreditor(row),
        name: version.startsWith('bfl-statement-')
          ? displayCreditorName(row.creditorShortName || row.name)
          : displayCreditorName(row.name),
        ...(isCreditorList && { arrears: '-', penalties: '-' }),
      })) ?? []
    );
  };
  return {
    debts: rows(debts),
    businessDebts: rows(businessDebts),
    creditorHeaders: creditorHeaders.map<Row>((row) => {
      const name = displayCreditorName(row.name);
      const short = displayCreditorName(row.creditorShortName);
      return {
        ...formatCreditor(row),
        name: name && short && short !== name ? `${name} (${short})` : name,
      };
    }),
    total: total === null ? null : formatBankruptcyMoney(total),
    totalWords,
  };
}

function groupDebtRows(rows: Row[]): Row[] {
  return groupCreditorObligations(rows).map((group) => {
    const first = group[0];
    const types = new Map<string, string>();
    let cents = 0n;
    let amountKnown = true;
    for (const row of group) {
      if (row.type?.trim()) types.set(comparableText(row.type), row.type);
      const amount = canonicalMoneyAmount(row.amount ?? '');
      if (amount === undefined) amountKnown = false;
      else cents += BigInt(amount.replace('.', ''));
    }
    return {
      ...first,
      name:
        group.find((row) => row.creditorLegalName)?.creditorLegalName ??
        first?.name ??
        null,
      address: group.find((row) => row.address)?.address ?? null,
      type: types.size ? [...types.values()].join('; ') : null,
      basis: group.map((row) => contractNarrative(row, 'creditors')).join('; '),
      amount: amountKnown
        ? `${String(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}`
        : null,
    };
  });
}

export function formatPreviousNames(value: string): string {
  const text = comparableText(value);
  return /^(?:[-–—]|(?:(?:фио|фамилия(?:, имя(?: и|,) отчество)?) )?не (?:из)?менял(?:ся|ась|ось|ись|а)?\.?)$/u.test(
    text,
  )
    ? '-'
    : value;
}

function displayCreditorName(value: string | null | undefined) {
  return value ? formatCreditorText(value) : null;
}

function formatCreditor(row: Row): Row {
  return {
    ...row,
    address: row.address ? formatCreditorText(row.address) : null,
    amount: row.amount ? formatBankruptcyMoney(row.amount) : null,
  };
}

export function bankruptcyCollectionCell(
  key: string,
  value: string | null | undefined,
  collection: Value,
  modern: boolean,
): string {
  if (!modern) return value ?? '[не заполнено]';
  if (Array.isArray(collection) && !collection.length) return '-';
  if (value && ['amount', 'value', 'balance', 'nominal'].includes(key))
    return formatBankruptcyMoney(value);
  return value ?? '[не заполнено]';
}

export function statementDefaults(values: Values) {
  const parts = statementNameParts(values);
  const full = [parts.last, parts.first, parts.middle]
    .filter(Boolean)
    .join(' ');
  const female = statementDebtorGender(values) === 'female';
  const born =
    full && typeof values.birthDate === 'string'
      ? `${full} ${values.birthDate} года рождения`
      : full;
  return {
    insolvencyDetails:
      'Удовлетворение требований одного из кредиторов или нескольких кредиторов приведет к невозможности исполнения должником денежных обязательств и (или) обязанности по уплате обязательных платежей в полном объеме перед другими кредиторами. Возможности удовлетворить в полном объеме требований кредиторов у должника не имеется.',
    companyParticipationDetails: `В течение трех лет до даты подачи заявления я${born ? `, ${born},` : ''} не ${female ? 'являлась' : 'являлся'} участником никаких коммерческих организаций, в том числе обществ с ограниченной ответственностью и акционерных обществ. Соответственно, сделок по отчуждению долей, акций, ценных бумаг, ввиду отсутствия коих, не ${female ? 'проводила' : 'проводил'} и сведений не имею.`,
    majorTransactionsDetails:
      'В течение предшествующих трех лет до даты подачи заявления мной не были совершены сделки по отчуждению или приобретению имущества свыше 300 000 руб.',
    liabilityDetails: `Я${full ? `, ${full},` : ''} не ${female ? 'привлекалась' : 'привлекался'} к административной ответственности за мелкое хищение, умышленное уничтожение или повреждение имущества, неправомерные действия при банкротстве, фиктивное или преднамеренное банкротство.`,
    criminalCasesDetails:
      'У меня не имеется сведений об известных уголовных и административных делах в отношении меня, а также о наличии неснятой или непогашенной судимости.',
    propertyDetails:
      'В настоящее время в моей собственности находится имущество, указанное в описи имущества, составленной по форме, утвержденной Приказом Минэкономразвития России от 05.08.2015 № 530.',
  };
}

export function statementDefaultValue(values: Values, key: string) {
  if (values[key] != null) return undefined;
  const defaults: Record<string, string> = statementDefaults(values);
  return Object.hasOwn(defaults, key) ? defaults[key] : undefined;
}

export function employmentStatement(
  values: Values,
  employment: ReturnType<typeof assessEmployment>,
  revised = false,
): string | null {
  if (employment.status !== 'active') return employment.statement;
  const { last, first, middle } = statementNameParts(values);
  const full = [last, first, middle].filter(Boolean).join(' ');
  const opening = `В настоящее время я${full ? `, ${full},` : ''} осуществляю трудовую деятельность в ${employment.employer}.`;
  if (employment.average === null) return opening;
  const words = revised
    ? filingMoneyWords(employment.average)
    : formatMoneyAmount(employment.average, 'RUB_WORDS');
  return (
    opening +
    ` Мой доход составляет ${formatBankruptcyMoney(employment.average)} (${words}), после налогообложения.`
  );
}

export function familyStatement(value: string): string {
  const thirdPerson =
    /(?:^|[.!?]\s+)(?:должник(?:а|у|ом)?|должниц[аеуы]|заявител[ьяю]|заявительниц[аеуы]|(?:его|е[её]) супруг[а]?|у (?:него|не[её]) на иждивении|(?:не )?состоит в браке|в (?:зарегистрированном )?браке (?:не )?состоит|[^.!?,]{1,120}\sсообщил[а]?,\s*что)(?=[\s,.—-]|$)/iu;
  return thirdPerson.test(value)
    ? '[проверьте формулировку от первого лица] ' + value
    : value;
}
