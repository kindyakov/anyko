import type { z } from 'zod';

import type { candidateSchema } from './candidate';
import { fieldIdentity, type FieldValue } from './fields';

type Candidate = z.infer<typeof candidateSchema>;

const dateFields = new Set([
  'documentDate',
  'birthDate',
  'passportIssuedAt',
  'debtAsOfDate',
]);
const moneyColumns = new Set(['amount', 'arrears', 'penalties']);
const datesInQuote =
  /(?<!\d)(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})(?!\d)/g;

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

function date(value: string): string | undefined {
  const text = value.trim();
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  const iso = local
    ? [local[3], local[2]?.padStart(2, '0'), local[1]?.padStart(2, '0')].join(
        '-',
      )
    : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  const calendar = new Date(iso + 'T00:00:00.000Z');
  if (
    Number.isNaN(calendar.valueOf()) ||
    !calendar.toISOString().startsWith(iso)
  )
    return;
  return iso;
}

function attestedDate(value: string, quote: string) {
  const expected = date(value);
  const found = quote.match(datesInQuote) ?? [];
  return (
    expected !== undefined && found.some((item) => date(item) === expected)
  );
}

function amount(value: string): string | undefined {
  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(
    value.trim().replace(/[ \u00a0\u202f]/g, ''),
  );
  if (!match || match[2] === undefined) return;
  return (
    (match[1] ?? '') +
    match[2].replace(/^0+(?=\d)/, '') +
    '.' +
    (match[3] ?? '').padEnd(2, '0')
  );
}

function attestedAmount(value: string, quote: string) {
  const expected = amount(value);
  const found =
    quote
      .replace(datesInQuote, ' ')
      .match(/-?\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?/g) ?? [];
  return (
    expected !== undefined && found.some((item) => amount(item) === expected)
  );
}

function proofLines(evidence: Candidate['evidence']) {
  return evidence
    .filter(({ imagePath }) => imagePath === null)
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
    const matches = dateFields.has(field)
      ? attestedDate
      : field === 'debtTotal'
        ? attestedAmount
        : null;
    return matches &&
      !proofLines(candidate.evidence).some((quote) => matches(value, quote))
      ? null
      : value;
  }
  if (!Array.isArray(value)) return value;
  const identity = fieldIdentity(field);
  const lines = proofLines(candidate.evidence);
  return value.map((row) => {
    const matching = identity.length
      ? lines.filter((line) =>
          identity.every((column) => {
            const marker = row[column]?.trim().toLocaleLowerCase('ru');
            return marker && line.toLocaleLowerCase('ru').includes(marker);
          }),
        )
      : [];
    return Object.fromEntries(
      Object.entries(row).map(([column, cell]) => {
        if (cell === null) return [column, cell];
        if (moneyColumns.has(column))
          return [
            column,
            matching.some((line) => attestedAmount(cell, line)) ? cell : null,
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
        return [column, cell];
      }),
    );
  });
}
