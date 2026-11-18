import { expect, test } from 'bun:test';

import type { FieldValue, FieldValues } from '@anyko/contracts/catalog';

import {
  draftForSave,
  hasFactsDraftEdits,
  startFactsDraft,
  transitionFactsDraft,
} from './facts-draft';

function revision(
  revision: number,
  server: FieldValues,
  cleanupPending = false,
) {
  return { revision, server, cleanupPending };
}

function rebase({
  base,
  mine,
  theirs,
}: {
  base: FieldValues;
  mine: FieldValues;
  theirs: FieldValues;
}) {
  const { draft, formChange } = transitionFactsDraft(
    startFactsDraft(revision(1, base)),
    mine,
    { type: 'revision', snapshot: revision(2, theirs) },
  );
  return {
    values: formChange?.values ?? formChange?.resetTo,
    editConflicts: draft.editConflicts.map((key) => ({
      key,
      theirs: draft.server[key],
    })),
  };
}

const debts = [{ name: 'Банк', amount: '100' }];
const debtsEdited = [{ name: 'Банк', amount: '250' }];

test('a field the user did not change takes the new server value', () => {
  const result = rebase({
    base: { personName: 'Иван', documentNumber: '1' },
    mine: { personName: 'Иван', documentNumber: '1' },
    theirs: { personName: 'Иван Петров', documentNumber: '1' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров', documentNumber: '1' },
    editConflicts: [],
  });
});

test('a field the server did not change keeps the user edit', () => {
  const result = rebase({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петров' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров' },
    editConflicts: [],
  });
});

test('when both sides arrived at the same value there is no conflict', () => {
  const result = rebase({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петров' },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петров' },
    editConflicts: [],
  });
});

test('both sides changed the field differently: the user value stays and the server value is reported', () => {
  const result = rebase({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван Петрович' },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван Петрович' },
    editConflicts: [{ key: 'personName', theirs: 'Иван Петров' }],
  });
});

test('a conflict is reported for every changed field, in the order of the keys', () => {
  const result = rebase({
    base: { personName: 'А', documentNumber: 'Б', documentDate: 'В' },
    mine: { personName: 'А1', documentNumber: 'Б1', documentDate: 'В' },
    theirs: { personName: 'А2', documentNumber: 'Б2', documentDate: 'В2' },
  });
  expect(result.values).toEqual({
    personName: 'А1',
    documentNumber: 'Б1',
    documentDate: 'В2',
  });
  expect(result.editConflicts).toEqual([
    { key: 'personName', theirs: 'А2' },
    { key: 'documentNumber', theirs: 'Б2' },
  ]);
});

test('a value cleared by the user is an edit, not a missing value', () => {
  const result = rebase({
    base: { personName: 'Иван' },
    mine: { personName: null },
    theirs: { personName: 'Иван Петров' },
  });
  expect(result).toEqual({
    values: { personName: null },
    editConflicts: [{ key: 'personName', theirs: 'Иван Петров' }],
  });
});

test('a key missing in base but added by the server takes the server value', () => {
  const result = rebase({
    base: {},
    mine: {},
    theirs: { observations: 'Новое' },
  });
  expect(result).toEqual({
    values: { observations: 'Новое' },
    editConflicts: [],
  });
});

test('a key the server removed is dropped when the user did not edit it', () => {
  const result = rebase({
    base: { personName: 'Иван', observations: 'Заметка' },
    mine: { personName: 'Иван', observations: 'Заметка' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({ values: { personName: 'Иван' }, editConflicts: [] });
});

test('a key the user added and the server does not have stays with the user', () => {
  const result = rebase({
    base: { personName: 'Иван' },
    mine: { personName: 'Иван', observations: 'Моя заметка' },
    theirs: { personName: 'Иван' },
  });
  expect(result).toEqual({
    values: { personName: 'Иван', observations: 'Моя заметка' },
    editConflicts: [],
  });
});

test('a value the user edited and the server removed is a conflict', () => {
  const result = rebase({
    base: { observations: 'Заметка' },
    mine: { observations: 'Моя заметка' },
    theirs: {},
  });
  expect(result).toEqual({
    values: { observations: 'Моя заметка' },
    editConflicts: [{ key: 'observations', theirs: undefined }],
  });
});

test('a key present only in base and removed by both sides disappears without a conflict', () => {
  const result = rebase({
    base: { observations: 'Заметка' },
    mine: {},
    theirs: {},
  });
  expect(result).toEqual({ values: {}, editConflicts: [] });
});

test('collections are compared structurally: the server rows replace the rows the user did not touch', () => {
  const result = rebase({
    base: { debts },
    mine: { debts },
    theirs: { debts: [...debts, { name: 'Кредитор', amount: '5' }] },
  });
  expect(result).toEqual({
    values: { debts: [...debts, { name: 'Кредитор', amount: '5' }] },
    editConflicts: [],
  });
});

test('an edited collection stays with the user when the server did not touch it', () => {
  const result = rebase({
    base: { debts },
    mine: { debts: debtsEdited },
    theirs: { debts },
  });
  expect(result).toEqual({ values: { debts: debtsEdited }, editConflicts: [] });
});

test('the same edit of a collection on both sides is not a conflict, even with other column order', () => {
  const result = rebase({
    base: { debts },
    mine: { debts: [{ amount: '250', name: 'Банк' }] },
    theirs: { debts: debtsEdited },
  });
  expect(result).toEqual({
    values: { debts: [{ amount: '250', name: 'Банк' }] },
    editConflicts: [],
  });
});

test('reordered rows are a different collection and conflict with the user edit', () => {
  const first = { name: 'Банк', amount: '100' };
  const second = { name: 'Кредитор', amount: '5' };
  const result = rebase({
    base: { debts: [first, second] },
    mine: { debts: [second, first] },
    theirs: { debts: [first, second, { name: 'Новый', amount: '1' }] },
  });
  expect(result.values).toEqual({ debts: [second, first] });
  expect(result.editConflicts).toEqual([
    {
      key: 'debts',
      theirs: [first, second, { name: 'Новый', amount: '1' }],
    },
  ]);
});

test('a row whose column is missing on one side is not equal to a row with null in it', () => {
  const withNull: FieldValue = [{ name: 'Банк', amount: null }];
  const withoutColumn: FieldValue = [{ name: 'Банк' }];
  const result = rebase({
    base: { debts: [{ name: 'Банк', amount: '100' }] },
    mine: { debts: withNull },
    theirs: { debts: withoutColumn },
  });
  expect(result.editConflicts).toEqual([
    { key: 'debts', theirs: withoutColumn },
  ]);
  expect(result.values).toEqual({ debts: withNull });
});

test('the inputs are not changed by the rebase', () => {
  const base = { personName: 'Иван' };
  const mine = { personName: 'Иван Петров' };
  const theirs = { personName: 'Иван Сергеевич' };
  rebase({ base, mine, theirs });
  expect(base).toEqual({ personName: 'Иван' });
  expect(mine).toEqual({ personName: 'Иван Петров' });
  expect(theirs).toEqual({ personName: 'Иван Сергеевич' });
});

test('an unresolved edit conflict follows later revisions until the server agrees', () => {
  const mine = { personName: 'Моя правка', observations: 'Старое' };
  const first = transitionFactsDraft(
    startFactsDraft(
      revision(1, { personName: 'Иван', observations: 'Старое' }),
    ),
    mine,
    {
      type: 'revision',
      snapshot: revision(2, {
        personName: 'Версия сервера',
        observations: 'Старое',
      }),
    },
  );
  expect(first.draft.editConflicts).toEqual(['personName']);
  expect(draftForSave(first.draft, mine)).toBeNull();

  const another = revision(3, {
    personName: 'Версия сервера',
    observations: 'Новое',
  });
  const next = transitionFactsDraft(first.draft, mine, {
    type: 'revision',
    snapshot: another,
  });
  expect(next.draft.editConflicts).toEqual(['personName']);
  expect(next.formChange).toEqual({
    resetTo: another.server,
    values: { ...mine, observations: 'Новое' },
  });

  const agreed = revision(4, { ...mine, observations: 'Новое' });
  const resolved = transitionFactsDraft(
    next.draft,
    { ...mine, observations: 'Новое' },
    { type: 'revision', snapshot: agreed },
  );
  expect(resolved.draft.editConflicts).toEqual([]);
  expect(resolved.formChange).toEqual({ resetTo: agreed.server });
  expect(hasFactsDraftEdits(resolved.draft, agreed.server)).toBe(false);
});

test('a response for the same revision and cleanup mode leaves the form alone', () => {
  const draft = startFactsDraft(revision(2, { personName: 'Иван' }));
  const mine = { personName: 'Моя правка' };
  const result = transitionFactsDraft(draft, mine, {
    type: 'revision',
    snapshot: revision(2, { personName: 'Новый ответ' }),
  });
  expect(result.draft).toBe(draft);
  expect(result.formChange).toBeUndefined();
  expect(hasFactsDraftEdits(result.draft, mine)).toBe(true);
});

test('starting cleanup at the same revision resets the form and ends the edit conflict', () => {
  const mine = { personName: 'Моя правка' };
  const first = transitionFactsDraft(
    startFactsDraft(revision(1, { personName: 'Иван' })),
    mine,
    {
      type: 'revision',
      snapshot: revision(2, { personName: 'Версия сервера' }),
    },
  );
  const cleanup = revision(2, {}, true);
  const started = transitionFactsDraft(first.draft, mine, {
    type: 'revision',
    snapshot: cleanup,
  });
  expect(started.draft.editConflicts).toEqual([]);
  expect(started.formChange).toEqual({ resetTo: {} });
  expect(hasFactsDraftEdits(started.draft, mine)).toBe(false);

  const finished = transitionFactsDraft(
    started.draft,
    {},
    { type: 'revision', snapshot: revision(2, {}) },
  );
  expect(finished.formChange).toEqual({ resetTo: {} });
  expect(finished.draft.cleanupPending).toBe(false);
});

test('keeping my edit drops the conflict and prepares a save at the synchronized revision', () => {
  const mine = { personName: 'Моя правка' };
  const conflict = transitionFactsDraft(
    startFactsDraft(revision(1, { personName: 'Иван' })),
    mine,
    {
      type: 'revision',
      snapshot: revision(2, { personName: 'Версия сервера' }),
    },
  );
  const kept = transitionFactsDraft(conflict.draft, mine, {
    type: 'keep-edit',
    key: 'personName',
  });
  expect(kept.draft.editConflicts).toEqual([]);
  expect(kept.formChange).toBeUndefined();
  expect(draftForSave(kept.draft, mine)).toEqual({ revision: 2, values: mine });
});

test('taking the server resolves only that edit conflict and removes a deleted field', () => {
  const mine = {
    personName: 'Моя правка',
    observations: 'Моя заметка',
    documentNumber: '42',
  };
  const server = { personName: 'Версия сервера' };
  const conflict = transitionFactsDraft(
    startFactsDraft(
      revision(1, { personName: 'Иван', observations: 'Заметка' }),
    ),
    mine,
    { type: 'revision', snapshot: revision(2, server) },
  );
  const remove = transitionFactsDraft(conflict.draft, mine, {
    type: 'take-server',
    key: 'observations',
  });
  expect(remove.draft.editConflicts).toEqual(['personName']);
  const values = { personName: 'Моя правка', documentNumber: '42' };
  expect(remove.formChange).toEqual({ values });
  const take = transitionFactsDraft(remove.draft, values, {
    type: 'take-server',
    key: 'personName',
  });
  expect(take.draft.editConflicts).toEqual([]);
  expect(take.formChange).toEqual({
    values: { ...server, documentNumber: '42' },
  });
});

test('discard and a successful save reset the form to their respective server values', () => {
  const mine = { personName: 'Моя правка' };
  const server = { personName: 'Версия сервера' };
  const conflict = transitionFactsDraft(
    startFactsDraft(revision(1, { personName: 'Иван' })),
    mine,
    { type: 'revision', snapshot: revision(2, server) },
  );
  const discarded = transitionFactsDraft(conflict.draft, mine, {
    type: 'discard',
  });
  expect(discarded.draft.editConflicts).toEqual([]);
  expect(discarded.formChange).toEqual({ resetTo: server });
  const accepted = revision(3, { personName: 'Сохранённое значение' });
  const saved = transitionFactsDraft(conflict.draft, mine, {
    type: 'saved',
    snapshot: accepted,
  });
  expect(saved.draft).toEqual({ ...accepted, editConflicts: [] });
  expect(saved.formChange).toEqual({ resetTo: accepted.server });
  expect(hasFactsDraftEdits(saved.draft, accepted.server)).toBe(false);
});
