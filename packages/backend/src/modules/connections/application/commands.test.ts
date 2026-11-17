import { expect, test } from 'bun:test';

import { memberScope } from '../../../../tests/support/scope';
import type { AuditModule } from '../../audit';

import type { LlmSettingsStore } from './ports';
import { revokeConnection } from './revoke';
import { saveConnection } from './save';

function fixture() {
  const writes: Parameters<AuditModule['commands']['record']>[0][] = [];
  let saved = 0,
    revoked = 0;
  const store: LlmSettingsStore = {
    lock: () => Promise.resolve(),
    current: () => Promise.resolve(null),
    connection: () => Promise.reject(new Error('unused')),
    save: () => {
      saved++;
      return Promise.resolve(2);
    },
    revoke: () => {
      revoked++;
      return Promise.resolve(revoked === 1 ? 2 : null);
    },
  };
  const audit = {
    commands: {
      record(event: Parameters<AuditModule['commands']['record']>[0]) {
        writes.push(event);
        return Promise.resolve();
      },
    },
  };
  return { store, audit, writes, saved: () => saved, revoked: () => revoked };
}
const input = {
  baseURL: 'http://localhost/v1',
  visionModel: 'vision',
  extractionModel: 'extract',
  apiKey: 'secret',
};
test('saving without connections.manage is forbidden before persistence', () => {
  const deps = fixture();
  expect(() =>
    saveConnection(deps)(memberScope('local', 'member', []), input),
  ).toThrow('FORBIDDEN');
  expect(deps.saved()).toBe(0);
  expect(deps.writes).toEqual([]);
});
test('revoking without connections.manage is forbidden before persistence', async () => {
  const deps = fixture();
  let code = '';
  try {
    await revokeConnection({ ...deps, clock: { now: () => new Date(0) } })(
      memberScope('local', 'member', []),
    );
  } catch (error) {
    code = error instanceof Error ? error.message : '';
  }
  expect(code).toBe('FORBIDDEN');
  expect(deps.revoked()).toBe(0);
  expect(deps.writes).toEqual([]);
});
test('revocation records only its revision and a repeat records nothing', async () => {
  const deps = fixture();
  const revoke = revokeConnection({
    ...deps,
    clock: { now: () => new Date(0) },
  });
  const scope = memberScope('local', 'owner', ['connections.manage']);
  await revoke(scope);
  await revoke(scope);
  expect(deps.writes).toEqual([
    {
      workspaceId: 'local',
      actorId: 'owner',
      action: 'connections.revoked',
      target: { kind: 'workspace', id: 'local' },
      data: { revision: 2 },
    },
  ]);
  expect(JSON.stringify(deps.writes)).not.toContain('secret');
});
