import type { z } from 'zod';

import {
  canonicalCalendarDate,
  datesInText,
} from '@anyko/document-values/calendar-date';
import {
  employmentEvents,
  employmentFields,
  employmentMonth,
} from '@anyko/document-values/employment';
import {
  canonicalMoneyAmount,
  moneyAmountsInText,
} from '@anyko/document-values/money';
import {
  creditorRegistryColumns,
  isBankObligation,
  obligationFields,
  obligationStatuses,
} from '@anyko/document-values/obligations';

import type { candidateSchema } from './candidate';
import {
  fieldIdentity,
  type FieldRow,
  type FieldValue,
  isCalendarDateField,
  isRublesColumn,
  isRublesField,
} from './fields';
import { evidencedObligationType } from './obligation-type';
import { hasRussianPassportCitizenship } from './passport-evidence';

type Candidate = z.infer<typeof candidateSchema>;

function digits(value: string) {
  return value.normalize('NFKC').replace(/[\s‐‑-]/g, '');
}

function checksum(value: string, weights: readonly number[]) {
  return weights.reduce((sum, weight, i) => sum + weight * Number(value[i]), 0);
}

function validInn(value: string, individual: boolean) {
  if (!/^[0-9]+$/.test(value) || /^0{4}/.test(value)) return false;
  const digit = (weights: readonly number[]) =>
    String((checksum(value, weights) % 11) % 10);
  if (value.length === 10 && !individual)
    return digit([2, 4, 10, 3, 5, 9, 4, 6, 8]) === value[9];
  return (
    value.length === 12 &&
    digit([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === value[10] &&
    digit([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === value[11]
  );
}

function validSnils(value: string) {
  if (!/^[0-9]{11}$/.test(value)) return false;
  const number = Number(value.slice(0, 9));
  if (number === 0) return false;
  if (number <= 1001998) return true;
  const sum = checksum(value, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  return (sum % 101) % 100 === Number(value.slice(-2));
}

function attestedIdentifier(value: string, quote: string) {
  const candidates =
    quote.match(/[0-9](?:[ \t\u00a0\u202f\u3000‐‑-]*[0-9])*/g) ?? [];
  return candidates.some((item) => digits(item) === value);
}

function attestedDate(value: string, quote: string) {
  const expected = canonicalCalendarDate(value);
  return (
    expected !== undefined &&
    datesInText(quote).some((item) => canonicalCalendarDate(item) === expected)
  );
}

function attestedAmount(value: string, quote: string, rubles = true) {
  const expected = canonicalMoneyAmount(value);
  const text = datesInText(quote).reduce(
    (remaining, date) => remaining.replace(date, ' '),
    quote.normalize('NFKC'),
  );
  if (expected === undefined) return false;
  if (rubles) return moneyAmountsInText(text).includes(expected);
  // The valuables register may give a value in a different currency.
  const values =
    text.match(/-?\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?/g) ?? [];
  return values.some((amount) => canonicalMoneyAmount(amount) === expected);
}

function proofLines(evidence: Candidate['evidence'], includeVisuals = false) {
  return evidence
    .filter(({ imagePath }) => includeVisuals || imagePath === null)
    .flatMap(({ quote }) =>
      quote
        .replace(/<\/tr>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\\([.()+-])/g, '$1')
        .split(/\r?\n/),
    );
}

/** Automatic values need numeric evidence. Keep the original proposal for human review. */
export function automaticValue(candidate: Candidate): FieldValue {
  return supportedValue(candidate, false);
}

/** After evidence loss, keep only values identifiable in the remaining quotes. */
export function valueWithRemainingEvidence(candidate: Candidate): FieldValue {
  return supportedValue(candidate, true);
}

function mentions(line: string, value: string) {
  const normalize = (text: string) =>
    text.normalize('NFKC').toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();
  return normalize(line).includes(normalize(value));
}

function supportedValue(
  candidate: Candidate,
  requireText: boolean,
): FieldValue {
  const { field, value } = candidate;
  if (typeof value === 'string') {
    if (field === 'citizenship')
      return candidate.evidence.some(
        ({ imagePath, quote }) =>
          imagePath === null && hasRussianPassportCitizenship(value, quote),
      )
        ? 'Российская Федерация'
        : null;
    if (field === 'inn' || field === 'snils') {
      const identifier = digits(value);
      const valid =
        field === 'inn' ? validInn(identifier, true) : validSnils(identifier);
      return valid &&
        proofLines(candidate.evidence).some((quote) =>
          attestedIdentifier(identifier, quote),
        )
        ? value
        : null;
    }
    const matches = isCalendarDateField(field)
      ? attestedDate
      : isRublesField(field)
        ? attestedAmount
        : requireText
          ? (text: string, line: string) => mentions(line, text)
          : null;
    return matches &&
      !proofLines(candidate.evidence).some((quote) => matches(value, quote))
      ? null
      : value;
  }
  if (!Array.isArray(value)) return value;
  if (field === 'attachments' && value.some(({ category }) => !!category))
    return null;
  if (employmentFields.some((key) => key === field))
    return evidencedEmployment(candidate, value);
  if (
    obligationFields.some((key) => key === field) &&
    value.some(isBankObligation)
  ) {
    const row = value.length === 1 ? value[0] : undefined;
    return row
      ? evidencedObligation(candidate.evidence, row, requireText)
      : null;
  }
  const identity = fieldIdentity(field);
  const lines = proofLines(candidate.evidence);
  const rows = value.flatMap((row) => {
    const markers = identity.map((column) => row[column]?.trim());
    const matching = markers.length
      ? lines.filter((line) =>
          markers.every((marker) =>
            marker ? mentions(line, marker) : requireText,
          ),
        )
      : requireText
        ? lines
        : [];
    const supported = Object.fromEntries(
      Object.entries(row)
        .filter(([column]) => !Object.hasOwn(creditorRegistryColumns, column))
        .map(([column, cell]) => {
          if (cell === null) return [column, cell];
          const rubles = isRublesColumn(field, column);
          if (rubles || (field === 'valuables' && column === 'amount'))
            return [
              column,
              matching.some((line) => attestedAmount(cell, line, rubles))
                ? rubles
                  ? (canonicalMoneyAmount(cell) ?? null)
                  : cell
                : null,
            ];
          if (column === 'inn') {
            const identifier = digits(cell);
            return [
              column,
              validInn(identifier, false) &&
              matching.some((line) => attestedIdentifier(identifier, line))
                ? cell
                : null,
            ];
          }
          return [
            column,
            requireText && !matching.some((line) => mentions(line, cell))
              ? null
              : cell,
          ];
        }),
    );
    return requireText &&
      Object.values(supported).every((cell) => cell === null)
      ? []
      : [supported];
  });
  return requireText && value.length && !rows.length ? null : rows;
}

function evidencedEmployment(
  candidate: Candidate,
  rows: FieldRow[],
): FieldValue {
  const documentIds = new Set(
    candidate.evidence.map(({ documentId }) => documentId),
  );
  const documents = [...documentIds].map((id) =>
    proofLines(
      candidate.evidence.filter(({ documentId }) => documentId === id),
      true,
    ),
  );
  const supported = rows.flatMap<FieldRow>((row) => {
    const employer = row.employer?.trim();
    if (!employer) return [];
    const employerSources = documents.filter((lines) =>
      lines.some((line) => mentions(line, employer)),
    );
    if (candidate.field === 'employmentHistory') {
      const date = canonicalCalendarDate(row.date ?? '');
      const event = row.event;
      const pattern =
        event === employmentEvents.hired
          ? /(?<![\p{L}])(?:при[её]м|принят[ао]?|назначен[ао]?)(?![\p{L}])/iu
          : event === employmentEvents.terminated
            ? /(?<![\p{L}])(?:увольнение|уволен[ао]?|трудов[а-я]+ договор (?:расторгнут|прекращ[её]н))(?![\p{L}])/iu
            : null;
      if (
        date &&
        event &&
        pattern &&
        employerSources.some((lines) =>
          lines.some((line) => pattern.test(line) && attestedDate(date, line)),
        )
      )
        return [{ employer, date, event }];
      return [];
    }
    const month = employmentMonth(row.month ?? '');
    const amount = canonicalMoneyAmount(row.amount ?? '');
    const code = row.code?.trim() || null;
    if (
      month &&
      amount &&
      !amount.startsWith('-') &&
      (code === null || /^\d{4}$/u.test(code)) &&
      employerSources.some((lines) =>
        evidencedIncomeMonth(lines, month, amount, code),
      )
    )
      return [{ employer, month, code, amount }];
    return [];
  });
  return supported.length ? supported : null;
}

function evidencedIncomeMonth(
  lines: string[],
  month: string,
  amount: string,
  code: string | null,
) {
  const year = month.slice(0, 4);
  const number = String(Number(month.slice(5)));
  const yearHeader = new RegExp(
    String.raw`(?:^\s*${year}\s*$|(?<!\d)${year}\s*(?:год|г\.)|год\s*[:=]\s*${year}(?!\d))`,
    'iu',
  );
  const monthLabel = new RegExp(
    String.raw`^\s*(?:\|\s*)?(?:месяц\s*[:=]?\s*)?0?${number}(?=\s|[|:;])`,
    'iu',
  );
  const fullMonth = new RegExp(String.raw`(?<!\d)${month}(?![-\d])`, 'u');
  const hasYear = lines.some((line) => yearHeader.test(line));
  return lines.some((line) => {
    const date =
      fullMonth.exec(line) ?? (hasYear ? monthLabel.exec(line) : null);
    if (!date) return false;
    const payment = line.slice(date.index + date[0].length);
    if (code === null) return attestedAmount(amount, payment);
    const codeCell = new RegExp(
      String.raw`^\s*(?:[|;:]\s*)?${code}(?=\s|[|;:])`,
      'u',
    ).exec(payment);
    return (
      codeCell !== null &&
      moneyAmountsInText(
        payment
          .slice(codeCell[0].length)
          .replace(/^\s*[|;:]\s*/u, '')
          .split(/[|;]/u, 1)[0] ?? '',
      )[0] === amount
    );
  });
}

/** The caller supplies evidence from one document. */
export function evidencedContract(
  evidence: Candidate['evidence'],
  { name, contractNumber, contractDate }: FieldRow,
) {
  if (!name || !contractNumber || !contractDate) return;
  const lines = proofLines(evidence, true);
  if (!lines.some((line) => mentions(line, name))) return;
  const number = contractNumber
    .trim()
    .replace(/^№\s*/, '')
    .normalize('NFKC')
    .toLowerCase();
  const matches = evidence.flatMap((entry) =>
    contractTypeCitations(proofLines([entry], true), number, contractDate),
  );
  if (matches.length)
    return {
      lines,
      typeCitations: matches,
      identity: { name, contractNumber, contractDate },
    };
}

function contractTypeCitations(
  quote: string[],
  number: string,
  contractDate: string,
) {
  const clauses = quote.flatMap((line) => line.split(';'));
  return clauses.flatMap((line, index) => {
    const numberToken = [
      ...line.matchAll(/[\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*/gu),
    ].find(([token]) => token.normalize('NFKC').toLowerCase() === number);
    if (!numberToken) return [];
    const directlyDated = attestedDate(contractDate, line);
    const nextDate = /^\s*дата\s+(?:заключения\s+)?договора\s*:\s*(.+)$/iu.exec(
      clauses[index + 1] ?? '',
    )?.[1];
    const labelledDate = canonicalCalendarDate(nextDate ?? '');
    const hasLabeledDate =
      /^\s*номер\s+договора\s*:\s*№?\s*\S+\s*$/iu.test(line) &&
      labelledDate !== undefined &&
      labelledDate === canonicalCalendarDate(contractDate);
    if (!directlyDated && !hasLabeledDate) return [];
    const prefix = line.slice(0, numberToken.index);
    // Ignore clauses before this number when they already refer to another document.
    const title = prefix.replace(/№\s*$/u, '');
    const boundTitle =
      /№/u.test(title) || datesInText(title).length ? '' : title;
    const detail = clauses[index + (hasLabeledDate ? 2 : 1)] ?? '';
    const type =
      /^\s*(?:вид|тип|продукт)(?:\s+(?:договора|обязательства|кредита|продукта))?\s*:\s*([^№]+)$/iu.exec(
        detail,
      )?.[1];
    return type &&
      !line.slice(numberToken.index + numberToken[0].length).includes('№')
      ? [boundTitle, type]
      : [boundTitle];
  });
}

function fullDebtAmount(line: string) {
  const total =
    /(?:общая|полная|итоговая)\s+(?:сумма\s+)?задолженность|(?:сумма|размер)\s+(?:общей\s+|полной\s+)?задолженности|задолженность\s*\(?всего\)?|^\s*задолженность\s*:/i.exec(
      line,
    );
  if (!total) return undefined;
  const tail =
    line
      .slice(total.index + total[0].length)
      .replace(/^\s*\|\s*/, '')
      .split(/[;|]/, 1)[0] ?? '';
  const withoutDates = datesInText(tail).reduce(
    (result, date) => result.replace(date, ' '),
    tail,
  );
  return moneyAmountsInText(withoutDates)[0];
}

/** A balance can outrank another only if its date and amount are unambiguous in the cited material. */
export function hasUnambiguousBalanceDate(
  evidence: Candidate['evidence'],
  row: FieldRow,
) {
  return [...new Set(evidence.map(({ documentId }) => documentId))].some(
    (id) => {
      const contract = evidencedContract(
        evidence.filter(({ documentId }) => documentId === id),
        row,
      );
      if (!contract) return false;
      const dates = new Set(
        contract.lines.flatMap((line) =>
          line
            .split(
              /(?:по состоянию на|на дату расч[её]та|дата расч[её]та)\s*[:—-]?\s*/iu,
            )
            .slice(1)
            .flatMap((section) => {
              const [date] = datesInText(section);
              return date ? [canonicalCalendarDate(date)] : [];
            }),
        ),
      );
      const amounts = new Set(
        contract.lines.map(fullDebtAmount).filter(Boolean),
      );
      const numbers = new Set(
        contract.lines.flatMap((line) =>
          [
            ...line.matchAll(
              /договор[а-яё]*\s+№\s*([\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*)/giu,
            ),
          ].map(([, number]) => number?.normalize('NFKC').toLowerCase()),
        ),
      );
      return (
        numbers.size <= 1 &&
        dates.size === 1 &&
        dates.has(row.amountDate ?? '') &&
        amounts.size === 1 &&
        amounts.has(row.amount ?? '')
      );
    },
  );
}

function evidencedObligation(
  evidence: Candidate['evidence'],
  row: FieldRow,
  requireText: boolean,
): FieldValue {
  const { contractDate, amountDate, debtStatus } = row;
  if (!contractDate || !amountDate) return null;
  const active = debtStatus === obligationStatuses.active;
  const statusPattern =
    debtStatus === obligationStatuses.closed
      ? /^\s*(?:(?:кредитный\s+договор|договор|кредит)\s+(?:был\s+)?закрыт|действие\s+договора\s+прекращено)\.?\s*$/iu
      : debtStatus === obligationStatuses.repaid
        ? /^\s*(?:(?:кредит|долг)\s+(?:был\s+)?полностью\s+погашен|задолженность\s+(?:полностью\s+погашена|отсутствует)|обязательства\s+(?:по\s+кредитному\s+договору\s+)?исполнены\s+в\s+полном\s+объ[её]ме)\.?\s*$/iu
        : null;
  const documentIds = [
    ...new Set(evidence.map(({ documentId }) => documentId)),
  ];
  const sameContract = documentIds.flatMap((id) => {
    const contract = evidencedContract(
      evidence.filter(({ documentId }) => documentId === id),
      row,
    );
    return contract?.lines.some((line) => attestedDate(amountDate, line))
      ? [contract]
      : [];
  });
  const amount = canonicalMoneyAmount(row.amount ?? '');
  const credible = sameContract.find(({ lines }) =>
    active
      ? amount !== undefined &&
        amount !== '0.00' &&
        !amount.startsWith('-') &&
        lines.some((line) => fullDebtAmount(line) === amount)
      : statusPattern !== null &&
        lines.some((line) => statusPattern.test(line)),
  );
  if (!credible) return null;
  return [
    Object.fromEntries(
      Object.entries({
        ...row,
        type: evidencedObligationType(credible.typeCitations),
        contractDate: canonicalCalendarDate(contractDate),
        amountDate: canonicalCalendarDate(amountDate),
        amount: active ? amount : null,
      }).flatMap(([column, cell]) => {
        if (cell == null || Object.hasOwn(creditorRegistryColumns, column))
          return [];
        if (
          [
            'name',
            'type',
            'contractNumber',
            'contractDate',
            'amountDate',
            'debtStatus',
            'amount',
          ].includes(column)
        )
          return [[column, cell]];
        if (['arrears', 'penalties', 'interest'].includes(column))
          return credible.lines.some((line) => attestedAmount(cell, line))
            ? [[column, canonicalMoneyAmount(cell) ?? cell]]
            : [];
        if (column === 'inn') {
          const identifier = digits(cell);
          return validInn(identifier, false) &&
            credible.lines.some((line) => attestedIdentifier(identifier, line))
            ? [[column, identifier]]
            : [];
        }
        return !requireText ||
          credible.lines.some((line) => mentions(line, cell))
          ? [[column, cell]]
          : [];
      }),
    ),
  ];
}
