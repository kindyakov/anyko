import {
  canonicalCalendarDate,
  datesInText,
} from '@anyko/document-values/calendar-date';
import {
  canonicalMoneyAmount,
  moneyAmountsInText,
} from '@anyko/document-values/money';

import type { FieldColumn, ValueDefinition } from './fields';

export function isRubles(column: FieldColumn | undefined) {
  return (
    column?.valueType === 'money' && column.moneyFormat !== 'sourceCurrency'
  );
}

export function canonicalScalar(
  definition: ValueDefinition | undefined,
  value: string,
) {
  if (definition?.valueType === 'date') return canonicalCalendarDate(value);
  if (definition?.valueType === 'money') return canonicalMoneyAmount(value);
  return value;
}

function validIdentifier(definition: ValueDefinition, value: string) {
  return definition.valueType === 'inn'
    ? validInn(value, definition.innLength === 12)
    : validSnils(value);
}

export function typedEvidence(
  definition: ValueDefinition | FieldColumn | undefined,
): ((value: string, quote: string) => boolean) | undefined {
  const evidence =
    definition && 'evidence' in definition ? definition.evidence : undefined;
  if (evidence === 'row') return undefined;
  switch (definition?.valueType) {
    case 'inn':
    case 'snils':
      return (value, quote) => {
        const identifier = digits(value);
        return (
          validIdentifier(definition, identifier) &&
          attestedIdentifier(identifier, quote)
        );
      };
    case 'date':
      return attestedDate;
    case 'money':
      return (value, quote) =>
        attestedAmount(value, quote, evidence !== 'sourceCurrency');
    default:
      // Passport and address are retained as text, as in the existing packages.
      return undefined;
  }
}

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

export function attestedDate(value: string, quote: string) {
  const expected = canonicalCalendarDate(value);
  return (
    expected !== undefined &&
    datesInText(quote).some((item) => canonicalCalendarDate(item) === expected)
  );
}

export function attestedAmount(value: string, quote: string, rubles = true) {
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
