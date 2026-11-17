import { expect, test } from 'bun:test';

import type { FieldValue } from '@anyko/contracts/catalog';

import { rebaseFacts } from './rebase';

const debts = [{ name: 'Банк', amount: '100' }];
const debtsEdited = [{ name: 'Банк', amount: '250' }];

test('a field the user did not change takes the new server value', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван', documentNumber: '1' },
    mine: { personName: 'Иван', documentNumber: '1' },
    theirs: { personName: 'Иван Петров', documentNumber: '1' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров', documentNumber: '1' },
    conflicts: [],
  });
});

test('a field the server did not change keeps the user edit', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петров' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров' },
    conflicts: [],
  });
});

test('when both sides arrived at the same value there is no conflict', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петров' },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров' },
    conflicts: [],
  });
});

test('both sides changed the field differently: the user value stays and the server value is reported', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петрович' },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петрович' },
    conflicts: [{ key: 'personName', theirs: 'Иван Петров' }],
  });
});

test('a conflict is reported for every changed field, in the order of the keys', () => {
  const result = rebaseFacts({
    base: { personName: 'А', documentNumber: 'Б', documentDate: 'В' },
    mine: { personName: 'А1', documentNumber: 'Б1', documentDate: 'В' },
    theirs: { personName: 'А2', documentNumber: 'Б2', documentDate: 'В2' },
  });
  expect(result.values).toEqual({
    personName: 'А1',
    documentNumber: 'Б1',
    documentDate: 'В2',
  });
  expect(result.conflicts).toEqual([
    { key: 'personName', theirs: 'А2' },
    { key: 'documentNumber', theirs: 'Б2' },
  ]);
});

test('a value cleared by the user is an edit, not a missing value', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван' },
    mine: { personName: null },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: null },
    conflicts: [{ key: 'personName', theirs: 'Иван Петров' }],
  });
});

test('a key missing in base but added by the server takes the server value', () => {
  const result = rebaseFacts({
    base: {},
    mine: {},
    theirs: { observations: 'Новое' },
  });
  expect(result).toEqual({ values: { observations: 'Новое' }, conflicts: [] });
});

test('a key the server removed is dropped when the user did not edit it', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван', observations: 'Заметка' },
    mine: { personName: 'Иван', observations: 'Заметка' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({ values: { personName: 'Иван' }, conflicts: [] });
});

test('a key the user added and the server does not have stays with the user', () => {
  const result = rebaseFacts({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван', observations: 'Моя заметка' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван', observations: 'Моя заметка' },
    conflicts: [],
  });
});

test('a value the user edited and the server removed is a conflict', () => {
  const result = rebaseFacts({
    base: { observations: 'Заметка' },
    mine: { observations: 'Моя заметка' },
    theirs: {},
  });
  expect(result).toEqual({
    values: { observations: 'Моя заметка' },
    conflicts: [{ key: 'observations', theirs: undefined }],
  });
});

test('a key present only in base and removed by both sides disappears without a conflict', () => {
  const result = rebaseFacts({
    base: { observations: 'Заметка' },
    mine: {},
    theirs: {},
  });
  expect(result).toEqual({ values: {}, conflicts: [] });
});

test('collections are compared structurally: the server rows replace the rows the user did not touch', () => {
  const result = rebaseFacts({
    base: { debts },
    mine: { debts },
    theirs: { debts: [...debts, { name: 'Кредитор', amount: '5' }] },
  });
  expect(result).toEqual({
    values: { debts: [...debts, { name: 'Кредитор', amount: '5' }] },
    conflicts: [],
  });
});

test('an edited collection stays with the user when the server did not touch it', () => {
  const result = rebaseFacts({
    base: { debts },
    mine: { debts: debtsEdited },
    theirs: { debts },
  });
  expect(result).toEqual({ values: { debts: debtsEdited }, conflicts: [] });
});

test('the same edit of a collection on both sides is not a conflict, even with other column order', () => {
  const result = rebaseFacts({
    base: { debts },
    mine: { debts: [{ amount: '250', name: 'Банк' }] },
    theirs: { debts: debtsEdited },
  });
  expect(result).toEqual({
    values: { debts: [{ amount: '250', name: 'Банк' }] },
    conflicts: [],
  });
});

test('reordered rows are a different collection and conflict with the user edit', () => {
  const first = { name: 'Банк', amount: '100' };
  const second = { name: 'Кредитор', amount: '5' };
  const result = rebaseFacts({
    base: { debts: [first, second] },
    mine: { debts: [second, first] },
    theirs: { debts: [first, second, { name: 'Новый', amount: '1' }] },
  });
  expect(result.values).toEqual({ debts: [second, first] });
  expect(result.conflicts).toEqual([
    {
      key: 'debts',
      theirs: [first, second, { name: 'Новый', amount: '1' }],
    },
  ]);
});

test('a row whose column is missing on one side is not equal to a row with null in it', () => {
  const withNull: FieldValue = [{ name: 'Банк', amount: null }];
  const withoutColumn: FieldValue = [{ name: 'Банк' }];
  const result = rebaseFacts({
    base: { debts: [{ name: 'Банк', amount: '100' }] },
    mine: { debts: withNull },
    theirs: { debts: withoutColumn },
  });
  expect(result.conflicts).toEqual([{ key: 'debts', theirs: withoutColumn }]);
  expect(result.values).toEqual({ debts: withNull });
});

test('the inputs are not changed by the rebase', () => {
  const base = { personName: 'Иван' };
  const mine = { personName: 'Иван Петров' };
  const theirs = { personName: 'Иван Сергеевич' };
  rebaseFacts({ base, mine, theirs });
  expect(base).toEqual({ personName: 'Иван' });
  expect(mine).toEqual({ personName: 'Иван Петров' });
  expect(theirs).toEqual({ personName: 'Иван Сергеевич' });
});
