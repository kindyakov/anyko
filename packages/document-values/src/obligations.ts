import { canonicalCalendarDate, formatCalendarDate } from './calendar-date';
import { canonicalMoneyAmount, formatMoneyAmount } from './money';

type DebtRow = Record<string, string | null>;
type DebtValue = string | DebtRow[] | null | undefined;

export const obligationFields = ['debts', 'businessDebts'] as const;
export const obligationStatuses = {
  active: 'Действует',
  repaid: 'Погашен',
  closed: 'Закрыт',
} as const;

export const obligationColumns = {
  contractNumber: 'Номер договора',
  contractDate: 'Дата договора',
  amountDate: 'Дата расчёта суммы',
  debtStatus: 'Статус: Действует, Погашен или Закрыт',
  interest: 'Проценты, руб.',
} as const;

export const obligationTemplate = (version: string | undefined) =>
  version === 'bfl-statement-v7' ||
  version === 'bfl-statement-v8' ||
  version === 'bfl-creditors-v2';

export function isBankObligation(row: DebtRow) {
  return Object.keys(obligationColumns).some((column) => row[column]?.trim());
}

const normalized = (value: string | null | undefined) =>
  value?.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim() ??
  '';

const creditorName = (value: string | null | undefined) =>
  normalized(value)
    .replace(/[«»"„“”]/g, '')
    .replace(/\s+/g, ' ');

function sameCreditor(a: DebtRow, b: DebtRow) {
  if (a.inn && b.inn)
    return a.inn.replace(/\s/g, '') === b.inn.replace(/\s/g, '');
  if (a.ogrn && b.ogrn)
    return a.ogrn.replace(/\s/g, '') === b.ogrn.replace(/\s/g, '');
  const name = creditorName(a.name);
  return !!name && name === creditorName(b.name);
}

const contractNumber = (row: DebtRow) =>
  normalized(row.contractNumber).replace(/^№\s*/, '').replace(/\s+/g, '');

export function sameObligation(a: DebtRow, b: DebtRow) {
  if (!sameCreditor(a, b)) return false;
  const first = contractNumber(a);
  const second = contractNumber(b);
  if (first && second) {
    if (first !== second) return false;
    const firstDate = canonicalCalendarDate(a.contractDate ?? '');
    const secondDate = canonicalCalendarDate(b.contractDate ?? '');
    return !firstDate || !secondDate || firstDate === secondDate;
  }
  const basis = normalized(a.basis);
  return !!basis && basis === normalized(b.basis);
}

export function applyObligationCandidate(
  saved: DebtValue,
  proposed: DebtRow[],
) {
  const rows = Array.isArray(saved) ? [...saved] : [];
  for (const row of proposed) {
    const index = rows.findIndex((current) => sameObligation(current, row));
    if (index < 0) rows.push(row);
    else {
      const previous = rows[index];
      rows[index] = {
        ...row,
        ...Object.fromEntries(
          ['address', 'ogrn', 'inn'].flatMap((key) =>
            !row[key] && previous?.[key] ? [[key, previous[key]]] : [],
          ),
        ),
      };
    }
  }
  return rows;
}

export function obligationAmounts(debts: DebtValue, businessDebts: DebtValue) {
  const registered: DebtRow[] = [];
  const headers: DebtRow[] = [];
  const activeRows = (input: DebtValue) => {
    if (!Array.isArray(input)) return null;
    return input.flatMap((row) => {
      const status = normalized(row.debtStatus);
      if (status && status !== normalized(obligationStatuses.active)) return [];
      const amount = canonicalMoneyAmount(row.amount ?? '');
      if (amount === '0.00' || amount?.startsWith('-')) return [];
      if (registered.some((previous) => sameObligation(previous, row)))
        return [];
      registered.push(row);
      const creditor = headers.find((previous) => sameCreditor(previous, row));
      if (creditor) {
        for (const key of ['address', 'ogrn', 'inn'])
          creditor[key] ??= row[key] ?? null;
      } else {
        headers.push({ ...row });
      }
      const date = row.contractDate
        ? formatCalendarDate(row.contractDate, 'DD.MM.YYYY')
        : '';
      const basis = row.contractNumber
        ? [
            'Договор № ' + row.contractNumber.replace(/^№\s*/, ''),
            date && 'от ' + date,
          ]
            .filter(Boolean)
            .join(' ')
        : row.basis;
      return [
        {
          ...row,
          basis: basis ?? null,
          amount: amount?.replace('.', ',') ?? null,
        },
      ];
    });
  };
  const personal = activeRows(debts);
  const business = activeRows(businessDebts);
  const entries = [...(personal ?? []), ...(business ?? [])];
  const sum = entries.reduce(
    (total, entry) => total + BigInt(entry.amount?.replace(',', '') ?? '0'),
    0n,
  );
  const total =
    entries.some((entry) => entry.amount === null) ||
    (personal === null && business === null)
      ? null
      : String(sum / 100n) + '.' + String(sum % 100n).padStart(2, '0');
  return {
    debts: personal,
    businessDebts: business,
    creditorHeaders: headers,
    total: total === null ? null : formatMoneyAmount(total, 'RUB_DECIMAL'),
    totalWords: total === null ? null : formatMoneyAmount(total, 'RUB_WORDS'),
  };
}
