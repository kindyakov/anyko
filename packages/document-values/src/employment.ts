import { canonicalCalendarDate, formatCalendarDate } from './calendar-date';
import { canonicalMoneyAmount, formatMoneyAmount } from './money';

export const employmentFields = [
  'employmentHistory',
  'employmentIncome',
] as const;

export const employmentEvents = {
  hired: 'Приём',
  terminated: 'Увольнение',
} as const;

type Row = Readonly<Record<string, string | null>>;
type Rows = string | readonly Row[] | null | undefined;
type WorkedMonth = { employer: string; month: string };

export function hasEmploymentFields(fields: readonly { key: string }[]) {
  return employmentFields.every((key) =>
    fields.some((field) => field.key === key),
  );
}

export function employmentMonth(value: string): string | undefined {
  const month = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (month && month[1] !== '0000') return month[0];
}

const employerKey = (name: string) =>
  name
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function readEmploymentRecord(row: Row) {
  const employer = row.employer?.trim();
  const date = row.date && canonicalCalendarDate(row.date);
  const event = row.event;
  if (
    !employer ||
    !date ||
    (event !== employmentEvents.hired && event !== employmentEvents.terminated)
  )
    return;
  return {
    employer,
    key: employerKey(employer),
    date: formatCalendarDate(date, 'YYYY-MM-DD'),
    event,
  };
}

function monthsBetween(from: string, to: string): string[] {
  const year = to.slice(0, 4);
  if (from > to) return [];
  const first = from.startsWith(year) ? Number(from.slice(5, 7)) : 1;
  const last = Number(to.slice(5, 7));
  return Array.from(
    { length: last - first + 1 },
    (_, offset) => year + '-' + String(first + offset).padStart(2, '0'),
  );
}

function incomeByMonth(
  rows: Rows,
  worked: ReadonlyMap<string, WorkedMonth>,
  year: string,
) {
  const income = new Map<
    string,
    { code: string; amount: bigint; sourceLine?: string }[]
  >();
  let incomplete = false;
  if (!rows || typeof rows === 'string') return { income, incomplete: true };
  for (const row of rows) {
    const month = employmentMonth(row.month ?? '');
    const employer = employerKey(row.employer ?? '');
    if (!month || !employer) {
      incomplete = true;
      continue;
    }
    if (!month.startsWith(year)) continue;
    const key = JSON.stringify([employer, month]);
    if (!worked.has(key)) continue;
    const amount = canonicalMoneyAmount(row.amount ?? '');
    if (amount === undefined || amount.startsWith('-')) {
      incomplete = true;
      continue;
    }
    const kopecks = BigInt(amount.replace('.', ''));
    const code = row.code?.trim() ?? '';
    const monthIncome = income.get(key) ?? [];
    const sourceLine = row.sourceLine?.trim();
    if (
      monthIncome.some(
        (prior) =>
          prior.code === code &&
          (!sourceLine || !prior.sourceLine || prior.sourceLine === sourceLine),
      )
    )
      incomplete = true;
    monthIncome.push({
      code,
      amount: kopecks,
      ...(sourceLine && { sourceLine }),
    });
    income.set(key, monthIncome);
  }
  return { income, incomplete };
}

const decimal = (kopecks: bigint) =>
  String(kopecks / 100n) + '.' + String(kopecks % 100n).padStart(2, '0');

export function assessEmployment(
  values: Readonly<Record<string, Rows>>,
  fallback = new Date().toISOString().slice(0, 10),
  needsReview: readonly string[] = [],
) {
  const fillDate = values.documentDate;
  const referenceDate =
    typeof fillDate === 'string'
      ? (canonicalCalendarDate(fillDate) ?? fallback)
      : fallback;
  const history = needsReview.includes('employmentHistory')
    ? null
    : values.employmentHistory;
  const payments = needsReview.includes('employmentIncome')
    ? null
    : values.employmentIncome;
  const statusUnknown = { status: 'review', statement: null } as const;
  const date = canonicalCalendarDate(referenceDate);
  if (!date || !history || typeof history === 'string' || !history.length)
    return statusUnknown;
  const asOf = formatCalendarDate(date, 'YYYY-MM-DD');
  const records = history.map(readEmploymentRecord);
  if (records.some((record) => record === undefined)) return statusUnknown;
  const effective = records
    .flatMap((record) => (record && record.date <= asOf ? [record] : []))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = effective.at(-1);
  if (
    !latest ||
    effective.some(
      (record) =>
        record.date === latest.date &&
        (record.event !== latest.event || record.key !== latest.key),
    )
  )
    return statusUnknown;

  if (latest.event === employmentEvents.terminated) {
    return {
      status: 'terminated',
      employer: latest.employer,
      date: formatCalendarDate(latest.date, 'DD.MM.YYYY'),
      statement: 'В настоящее время не осуществляю трудовую деятельность.',
    } as const;
  }

  const worked = new Map<string, WorkedMonth>();
  const open = new Map<string, { employer: string; date: string }>();
  const addMonths = (
    key: string,
    employer: string,
    start: string,
    end: string,
  ) => {
    for (const month of monthsBetween(start, end))
      worked.set(JSON.stringify([key, month]), { employer, month });
  };
  let incompleteHistory = false;
  for (const record of effective) {
    if (record.event === employmentEvents.hired) {
      const previous = open.get(record.key);
      if (previous && previous.date !== record.date) incompleteHistory = true;
      open.set(record.key, record);
      continue;
    }
    const start = open.get(record.key)?.date;
    if (!start && record.date.slice(0, 4) === asOf.slice(0, 4))
      incompleteHistory = true;
    if (start) addMonths(record.key, record.employer, start, record.date);
    open.delete(record.key);
  }
  for (const [key, { employer, date: start }] of open)
    addMonths(key, employer, start, asOf);

  const { income, incomplete } = incomeByMonth(
    payments,
    worked,
    asOf.slice(0, 4),
  );
  const sources = [...worked]
    .flatMap(([key, work]) =>
      (income.get(key) ?? []).map((entry) => ({ ...work, ...entry })),
    )
    .sort(
      (left, right) =>
        left.month.localeCompare(right.month) ||
        left.employer.localeCompare(right.employer, 'ru') ||
        left.code.localeCompare(right.code),
    );
  const months = [
    ...new Set([...worked.values()].map(({ month }) => month)),
  ].sort();
  const missing = [...worked].flatMap(([key, work]) =>
    income.has(key) ? [] : [work],
  );
  const complete =
    !incompleteHistory && !incomplete && !missing.length && months.length > 0;
  const total = sources.reduce((sum, row) => sum + row.amount, 0n);
  const denominator = BigInt(months.length) * 100n;
  const average = complete
    ? decimal((total * 87n + denominator / 2n) / denominator)
    : null;
  const statement = 'В настоящее время работаю в ' + latest.employer + '.';
  return {
    status: 'active',
    employer: latest.employer,
    months,
    missing,
    sources: sources.map((row) => ({ ...row, amount: decimal(row.amount) })),
    total: decimal(total),
    average,
    statement:
      average === null
        ? statement
        : statement +
          ' Средняя заработная плата после вычета 13% составляет ' +
          formatMoneyAmount(average, 'RUB_DECIMAL') +
          ' руб.',
  } as const;
}
