import { expect, test } from 'bun:test';

import { pickWorkspace } from '@/lib/workspace-choice';

const memberships = [
  { workspace: { id: 'first', name: 'Первая' } },
  { workspace: { id: 'second', name: 'Вторая' } },
];

test('the last opened workspace is chosen while the user still belongs to it', () => {
  expect(pickWorkspace(memberships, 'second')).toBe('second');
});

test('a last workspace the user no longer belongs to falls back to the first membership', () => {
  expect(pickWorkspace(memberships, 'foreign')).toBe('first');
  expect(pickWorkspace(memberships, '')).toBe('first');
});

test('without a last workspace the first membership is chosen', () => {
  expect(pickWorkspace(memberships, undefined)).toBe('first');
});

test('no memberships means no workspace, even when a last workspace is remembered', () => {
  expect(pickWorkspace([], undefined)).toBeUndefined();
  expect(pickWorkspace([], 'second')).toBeUndefined();
});
