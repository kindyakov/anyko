import { expect, test } from 'bun:test';

import { brandWorkId, parseUserId, parseWorkspaceId, uuidV7 } from './ids';

test('workspace ids accept the local id and reject values outside the URL-safe alphabet', () => {
  expect<string | null>(parseWorkspaceId('local')).toBe('local');
  expect(parseWorkspaceId('a'.repeat(128))).not.toBeNull();
  expect(parseWorkspaceId('')).toBeNull();
  expect(parseWorkspaceId('a'.repeat(129))).toBeNull();
  expect(parseWorkspaceId('work/space')).toBeNull();
  expect(parseWorkspaceId('../local')).toBeNull();
});

test('user ids accept any non-empty identifier from the auth provider', () => {
  expect(parseUserId('auth-user-1')).not.toBeNull();
  expect(parseUserId('')).toBeNull();
});

test('entity ids must be UUIDs; a malformed value fails instead of becoming an id', () => {
  const id = crypto.randomUUID();
  expect<string>(brandWorkId(id)).toBe(id);
  expect(() => brandWorkId('not-a-uuid')).toThrow('INVALID_WORK_ID');
});

test('generated ids are UUIDv7 and their timestamps never run backwards', () => {
  const values = Array.from({ length: 20 }, () => uuidV7());
  expect(new Set(values).size).toBe(values.length);
  for (const value of values)
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  // Первые 48 бит UUIDv7 — миллисекунды; созданные подряд не уходят назад во времени.
  const millis = values.map((value) =>
    parseInt(value.slice(0, 8) + value.slice(9, 13), 16),
  );
  for (let index = 1; index < millis.length; index += 1)
    expect(millis[index]).toBeGreaterThanOrEqual(millis[index - 1] ?? 0);
});
