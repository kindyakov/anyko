import type { z } from 'zod';

import {
  canonicalCalendarDate,
  datesInText,
} from '@anyko/document-values/calendar-date';
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

function evidencedObligation(
  evidence: Candidate['evidence'],
  row: FieldRow,
  requireText: boolean,
): FieldValue {
  const { name, contractNumber, contractDate, amountDate, debtStatus } = row;
  if (!name || !contractNumber || !contractDate || !amountDate) return null;
  const active = debtStatus === obligationStatuses.active;
  const statusPattern =
    debtStatus === obligationStatuses.closed
      ? /(?:договор|кредит)\s+(?:был\s+)?закрыт|действие договора прекращено/iu
      : debtStatus === obligationStatuses.repaid
        ? /полностью погашен|исполнены в полном объ[её]ме|задолженность отсутствует/iu
        : null;
  const documentIds = [
    ...new Set(evidence.map(({ documentId }) => documentId)),
  ];
  const sameContract = documentIds
    .map((id) =>
      proofLines(
        evidence.filter(({ documentId }) => documentId === id),
        true,
      ),
    )
    .filter(
      (lines) =>
        lines.some((line) => mentions(line, name)) &&
        lines.some((line) =>
          line
            .normalize('NFKC')
            .toLowerCase()
            .match(/[\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*/gu)
            ?.includes(
              contractNumber
                .trim()
                .replace(/^№\s*/, '')
                .normalize('NFKC')
                .toLowerCase(),
            ),
        ) &&
        lines.some((line) => attestedDate(contractDate, line)) &&
        lines.some((line) => attestedDate(amountDate, line)),
    );
  const amount = canonicalMoneyAmount(row.amount ?? '');
  const credible = sameContract.find((lines) =>
    active
      ? amount !== undefined &&
        amount !== '0.00' &&
        !amount.startsWith('-') &&
        lines.some((line) => {
          const total =
            /(?:общая|полная|итоговая)\s+(?:сумма\s+)?задолженность|(?:сумма|размер)\s+(?:общей\s+|полной\s+)?задолженности|задолженность\s*\(?всего\)?|^\s*задолженность\s*:/i.exec(
              line,
            );
          if (!total) return false;
          const tail =
            line
              .slice(total.index + total[0].length)
              .replace(/^\s*\|\s*/, '')
              .split(/[;|]/, 1)[0] ?? '';
          const withoutDates = datesInText(tail).reduce(
            (result, date) => result.replace(date, ' '),
            tail,
          );
          return moneyAmountsInText(withoutDates)[0] === amount;
        })
      : statusPattern !== null &&
        lines.some((line) => statusPattern.test(line)),
  );
  if (!credible) return null;
  return [
    Object.fromEntries(
      Object.entries({
        ...row,
        contractDate: canonicalCalendarDate(contractDate),
        amountDate: canonicalCalendarDate(amountDate),
        amount: active ? amount : null,
      }).flatMap(([column, cell]) => {
        if (cell == null || Object.hasOwn(creditorRegistryColumns, column))
          return [];
        if (
          [
            'name',
            'contractNumber',
            'contractDate',
            'amountDate',
            'debtStatus',
            'amount',
          ].includes(column)
        )
          return [[column, cell]];
        if (['arrears', 'penalties', 'interest'].includes(column))
          return credible.some((line) => attestedAmount(cell, line))
            ? [[column, canonicalMoneyAmount(cell) ?? cell]]
            : [];
        if (column === 'inn') {
          const identifier = digits(cell);
          return validInn(identifier, false) &&
            credible.some((line) => attestedIdentifier(identifier, line))
            ? [[column, identifier]]
            : [];
        }
        return !requireText || credible.some((line) => mentions(line, cell))
          ? [[column, cell]]
          : [];
      }),
    ),
  ];
}
