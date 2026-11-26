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

export const creditorRegistryColumns = {
  creditorLegalName: 'Полное наименование по реестру',
  creditorShortName: 'Краткое наименование по реестру',
  kpp: 'КПП',
  bic: 'БИК',
} as const;
const registryKeys = [
  ...Object.keys(creditorRegistryColumns),
  'inn',
  'ogrn',
  'address',
];

export const obligationTemplate = (version: string | undefined) =>
  version === 'statement' || version === 'creditors';

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
  if (creditorIdentifiersConflict(a, b)) return false;
  if (a.inn && b.inn)
    return a.inn.replace(/\s/g, '') === b.inn.replace(/\s/g, '');
  if (a.ogrn && b.ogrn)
    return a.ogrn.replace(/\s/g, '') === b.ogrn.replace(/\s/g, '');
  const name = creditorName(a.name);
  return !!name && name === creditorName(b.name);
}

function creditorIdentifiersConflict(a: DebtRow, b: DebtRow): boolean {
  return ['inn', 'ogrn'].some((key) => {
    const left = a[key]?.replace(/\s/gu, '');
    const right = b[key]?.replace(/\s/gu, '');
    return !!left && !!right && left !== right;
  });
}

export function groupCreditorObligations(
  rows: readonly DebtRow[],
): DebtRow[][] {
  const groups: DebtRow[][] = [];
  for (const row of rows) {
    const group = groups.find(
      (entries) =>
        entries.some((existing) => sameCreditor(existing, row)) &&
        entries.every(
          (existing) => !creditorIdentifiersConflict(existing, row),
        ),
    );
    if (group) group.push(row);
    else groups.push([row]);
  }
  return groups;
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
    return firstDate !== undefined && firstDate === secondDate;
  }
  const basis = normalized(a.basis);
  return !!basis && basis === normalized(b.basis);
}

export function hasOverlappingObligations(rows: readonly DebtRow[]): boolean {
  return rows.some((row, index) =>
    rows.slice(index + 1).some((other) => {
      if (sameObligation(row, other)) return true;
      if (creditorIdentifiersConflict(row, other)) return false;
      const number = contractNumber(row);
      const firstDate = canonicalCalendarDate(row.contractDate ?? '');
      const nextDate = canonicalCalendarDate(other.contractDate ?? '');
      const names = [row.name, row.creditorLegalName, row.creditorShortName]
        .map(creditorName)
        .filter(Boolean);
      return (
        !!number &&
        number === contractNumber(other) &&
        (!firstDate || !nextDate || firstDate === nextDate) &&
        (sameCreditor(row, other) ||
          [other.name, other.creditorLegalName, other.creditorShortName].some(
            (name) => names.includes(creditorName(name)),
          ))
      );
    }),
  );
}

/** Registry choices change only organisation details of a previously linked obligation. */
export function applyCreditorRegistryCandidate(
  saved: DebtValue,
  proposed: DebtRow[],
) {
  if (!Array.isArray(saved)) return saved;
  return saved.map((current) => {
    const match = proposed.find((row) => sameObligation(current, row));
    return match
      ? {
          ...current,
          ...Object.fromEntries(
            registryKeys.flatMap((key) =>
              match[key] ? [[key, match[key]]] : [],
            ),
          ),
        }
      : current;
  });
}

export function containsCreditorRegistryCandidate(
  saved: DebtValue,
  proposed: DebtValue,
) {
  return (
    Array.isArray(saved) &&
    Array.isArray(proposed) &&
    proposed.length > 0 &&
    proposed.every((row) =>
      saved.some(
        (current) =>
          sameObligation(current, row) &&
          registryKeys.every((key) => !row[key] || row[key] === current[key]),
      ),
    )
  );
}

export function canApplyCreditorRegistryCandidate(
  saved: DebtValue,
  proposed: DebtValue,
) {
  return (
    Array.isArray(saved) &&
    Array.isArray(proposed) &&
    proposed.every(
      (row) =>
        saved.filter((current) => sameObligation(current, row)).length === 1,
    )
  );
}

export function applyObligationCandidate(
  saved: DebtValue,
  proposed: DebtRow[],
) {
  const rows = Array.isArray(saved) ? [...saved] : [];
  for (const row of proposed) {
    const matches = rows.flatMap((current, index) =>
      sameObligation(current, row) ? [index] : [],
    );
    const index = matches.length === 1 ? matches[0] : undefined;
    if (index === undefined) rows.push(row);
    else {
      const previous = rows[index];
      rows[index] = {
        ...row,
        ...Object.fromEntries(
          registryKeys.flatMap((key) =>
            !row[key] && previous?.[key] ? [[key, previous[key]]] : [],
          ),
        ),
      };
    }
  }
  return rows;
}

export function obligationAmounts(
  debts: DebtValue,
  businessDebts: DebtValue,
  omitBlankRows = false,
) {
  const isSettled = ({ debtStatus }: DebtRow) =>
    [obligationStatuses.closed, obligationStatuses.repaid].some(
      (status) => normalized(status) === normalized(debtStatus),
    );
  const settled = [debts, businessDebts].flatMap((value) =>
    Array.isArray(value) ? value.filter(isSettled) : [],
  );
  const activeRows = (input: DebtValue) => {
    if (!Array.isArray(input)) return null;
    const rows = omitBlankRows
      ? input.filter((row) => Object.values(row).some((cell) => cell?.trim()))
      : input;
    if (omitBlankRows && input.length && !rows.length) return null;
    return rows.flatMap((row) => {
      const status = normalized(row.debtStatus);
      if (isSettled(row)) return [];
      const parsed = canonicalMoneyAmount(row.amount ?? '');
      const amount =
        (status && status !== normalized(obligationStatuses.active)) ||
        parsed?.startsWith('-') ||
        (parsed === '0.00' && isBankObligation(row)) ||
        settled.some((other) => hasOverlappingObligations([row, other]))
          ? undefined
          : parsed;
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
    hasOverlappingObligations(entries) ||
    personal === null ||
    business === null
      ? null
      : String(sum / 100n) + '.' + String(sum % 100n).padStart(2, '0');
  const withOfficialNames = (rows: DebtRow[] | null): DebtRow[] | null =>
    rows?.map((row) => ({
      ...row,
      name: row.creditorLegalName || row.name || null,
    })) ?? null;
  const headers = groupCreditorObligations(entries).map((rows) => {
    const header = { ...rows[0] };
    for (const key of registryKeys) {
      const values = new Set(
        rows.flatMap((row) => (row[key] ? [row[key]] : [])),
      );
      header[key] =
        values.size === 1 ? (values.values().next().value ?? null) : null;
    }
    return header;
  });
  return {
    debts: withOfficialNames(personal),
    businessDebts: withOfficialNames(business),
    creditorHeaders: withOfficialNames(headers) ?? [],
    total: total === null ? null : formatMoneyAmount(total, 'RUB_DECIMAL'),
    totalWords: total === null ? null : formatMoneyAmount(total, 'RUB_WORDS'),
  };
}
