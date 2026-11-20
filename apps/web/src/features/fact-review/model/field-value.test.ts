import { expect, test } from 'bun:test';

import { sameFieldValue, sameFieldValues } from './field-value';

test('text values are equal only when they are the same text', () => {
  expect(sameFieldValue('Иван', 'Иван')).toBe(true);
  expect(sameFieldValue('Иван', 'Иван ')).toBe(false);
  expect(sameFieldValue('', 'Иван')).toBe(false);
});

test('an empty value, a missing value and a text are three different values', () => {
  expect(sameFieldValue(null, null)).toBe(true);
  expect(sameFieldValue(null, undefined)).toBe(false);
  expect(sameFieldValue(undefined, undefined)).toBe(true);
  expect(sameFieldValue(null, '')).toBe(false);
  expect(sameFieldValue(undefined, 'Иван')).toBe(false);
});

test('a text and a collection are never equal', () => {
  expect(sameFieldValue('', [])).toBe(false);
  expect(sameFieldValue([], null)).toBe(false);
  expect(sameFieldValue([{ name: 'Банк' }], 'Банк')).toBe(false);
});

test('collections are equal by length, row order and row content', () => {
  expect(sameFieldValue([], [])).toBe(true);
  expect(
    sameFieldValue(
      [{ name: 'Банк', amount: '1' }],
      [{ name: 'Банк', amount: '1' }],
    ),
  ).toBe(true);
  expect(sameFieldValue([{ name: 'Банк' }], [])).toBe(false);
  expect(
    sameFieldValue(
      [{ name: 'А' }, { name: 'Б' }],
      [{ name: 'Б' }, { name: 'А' }],
    ),
  ).toBe(false);
  expect(sameFieldValue([{ name: 'Банк' }], [{ name: 'Банк2' }])).toBe(false);
});

test('column order inside a row does not matter, but a column without a value is not null', () => {
  expect(
    sameFieldValue(
      [{ name: 'Банк', amount: '1' }],
      [{ amount: '1', name: 'Банк' }],
    ),
  ).toBe(true);
  expect(
    sameFieldValue([{ name: 'Банк' }], [{ name: 'Банк', amount: null }]),
  ).toBe(false);
  expect(
    sameFieldValue([{ name: 'Банк', amount: null }], [{ name: 'Банк' }]),
  ).toBe(false);
});

test('a multi-row collection is compared row by row', () => {
  const bank = { name: 'Банк', amount: '1' };
  const creditor = { name: 'Кредитор', amount: null };
  const rows = [bank, creditor];
  expect(sameFieldValue(rows, structuredClone(rows))).toBe(true);
  expect(sameFieldValue(rows, [bank, { name: 'Кредитор', amount: '2' }])).toBe(
    false,
  );
});

test('whole field sets are equal when every key has an equal value on both sides', () => {
  expect(sameFieldValues({ a: 'x', b: null }, { b: null, a: 'x' })).toBe(true);
  expect(sameFieldValues({ a: 'x' }, { a: 'x', b: undefined })).toBe(true);
  expect(sameFieldValues({ a: 'x' }, { a: 'x', b: null })).toBe(false);
  expect(sameFieldValues({ a: 'x', b: 'y' }, { a: 'x' })).toBe(false);
});
