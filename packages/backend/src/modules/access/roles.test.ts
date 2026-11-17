import { expect, test } from 'bun:test';

import { rightCatalog } from '../../platform/scope';

import { rightsForRole } from './domain/roles';

test('owner holds every right in the catalog', () => {
  expect([...rightsForRole('owner')].sort()).toEqual([...rightCatalog].sort());
});

test('member holds every right except work deletion, connection management and invitations', () => {
  const member = rightsForRole('member');
  expect(member).not.toContain('works.delete');
  expect(member).not.toContain('connections.manage');
  expect(member).not.toContain('members.invite');
  expect(member).toContain('connections.read');
  expect(member).toContain('works.edit');
  expect(member.length).toBe(rightCatalog.length - 3);
});

test('an unknown role grants no rights', () => {
  expect(rightsForRole('viewer')).toEqual([]);
  expect(rightsForRole('')).toEqual([]);
});
