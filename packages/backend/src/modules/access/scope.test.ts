import { expect, test } from 'bun:test';

import { AppError } from '../../platform/errors';
import { parseUserId, parseWorkspaceId } from '../../platform/ids';
import { issueWorkspaceScope } from '../../platform/scope/issue';

import { type AccessSession, scopeFor } from './domain/scope';

function scopeWith(
  rights: Parameters<typeof issueWorkspaceScope>[0]['rights'],
) {
  const userId = parseUserId('user-1');
  const workspaceId = parseWorkspaceId('local');
  if (!userId || !workspaceId) throw new Error('fixture ids are invalid');
  return issueWorkspaceScope({ userId, workspaceId, rights });
}

test('a scope answers has() only for the rights it was issued with', () => {
  const scope = scopeWith(['works.read']);
  expect(scope.has('works.read')).toBe(true);
  expect(scope.has('works.edit')).toBe(false);
  expect<string>(scope.userId).toBe('user-1');
  expect<string>(scope.workspaceId).toBe('local');
  expect(scope.rights).toEqual(['works.read']);
});

test('require() passes for a held right and throws forbidden with the FORBIDDEN code otherwise', () => {
  const scope = scopeWith(['works.edit']);
  expect(() => {
    scope.require('works.edit');
  }).not.toThrow();
  let thrown: unknown;
  try {
    scope.require('connections.manage');
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(AppError);
  expect(thrown).toMatchObject({ code: 'FORBIDDEN', kind: 'forbidden' });
});

test('scopeFor issues a scope only for a workspace the user is a member of', () => {
  const session: AccessSession = {
    user: { id: 'user-1', name: 'Fixture', email: 'fixture@example.test' },
    memberships: [
      {
        workspace: { id: 'local', name: 'Local' },
        rights: ['works.read', 'works.edit'],
      },
    ],
  };
  const own = scopeFor(session, 'local');
  expect(own?.rights).toEqual(['works.read', 'works.edit']);
  expect(scopeFor(session, 'foreign')).toBeNull();
  expect(scopeFor(session, 'not valid!')).toBeNull();
});
