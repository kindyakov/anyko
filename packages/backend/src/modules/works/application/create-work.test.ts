import { expect, test } from 'bun:test';

import type { WorkStore } from '..';
import { memberScope } from '../../../../tests/support/scope';
import { isAppError } from '../../../platform/errors';
import { brandWorkId } from '../../../platform/ids';

import { createWork } from './create-work';

const WORK_ID = '0190f0a0-0000-7000-8000-000000000001';
const WORKSPACE = 'workspace-1';

// Заглушки портов: каждая операция записывается в журнал вызовов; неожиданный вызов падает.
function store(calls: string[]): WorkStore {
  const unused = () => Promise.reject(new Error('UNUSED'));
  return {
    list: unused,
    get: unused,
    documents: unused,
    workForDocument: unused,
    hasActiveDocument: unused,
    attach: unused,
    touch: unused,
    lockRevision: unused,
    events: unused,
    cursor: unused,
    dirty: unused,
    detachDeleted: unused,
    deletion: unused,
    requestDeletion: unused,
    pendingDeletions: unused,
    prepareDeletion: unused,
    failDeletion: unused,
    finishDeletion: unused,
    create(input) {
      calls.push(`create:${input.id}:${input.workspaceId}`);
      return Promise.resolve();
    },
    event(_workspaceId, _workId, kind) {
      calls.push(`event:${kind}`);
      return Promise.resolve();
    },
  };
}

async function failureOf(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error: unknown) {
    return isAppError(error) ? error.code : error;
  }
  return 'NO_ERROR';
}

test('a scope without works.create is refused before any write', async () => {
  const calls: string[] = [];
  const create = createWork({
    store: store(calls),
    newId: () => WORK_ID,
    knownPackage: () => true,
  });
  const scope = memberScope(WORKSPACE, 'reader', ['works.read']);
  expect(
    await failureOf(create(scope, { title: 'T', packageVersion: 'v1' })),
  ).toBe('FORBIDDEN');
  expect(calls).toEqual([]);
});

test('an unknown package is invalid input and writes nothing', async () => {
  const calls: string[] = [];
  const create = createWork({
    store: store(calls),
    newId: () => WORK_ID,
    knownPackage: () => false,
  });
  expect(
    await failureOf(
      create(memberScope(WORKSPACE), { title: 'T', packageVersion: 'missing' }),
    ),
  ).toBe('INVALID_WORK_INPUT');
  expect(calls).toEqual([]);
});

test('creates the work with the injected id in the scope workspace and records the event', async () => {
  const calls: string[] = [];
  const create = createWork({
    store: store(calls),
    newId: () => WORK_ID,
    knownPackage: () => true,
  });
  const id = await create(memberScope(WORKSPACE, 'owner-1'), {
    title: 'Синтетическая работа',
    packageVersion: 'technical-document-v1',
  });
  expect(id).toBe(brandWorkId(WORK_ID));
  expect(calls).toEqual([
    `create:${WORK_ID}:${WORKSPACE}`,
    'event:work.created',
  ]);
});
