import { expect, test } from 'bun:test';

import { memberScope } from '../../../tests/support/scope';
import { emptyFacts, type FactsModule } from '../../modules/facts';
import type { WorksModule, WorksPorts, WorkSummary } from '../../modules/works';
import { isAppError } from '../../platform/errors';
import { brandWorkId } from '../../platform/ids';
import { openTransaction } from '../../platform/transactions';

import { editValues } from './edit-values';

const WORK_ID = brandWorkId('0190f0a0-0000-7000-8000-000000000002');
const WORKSPACE = 'workspace-2';
const work: WorkSummary = {
  id: WORK_ID,
  title: 'Синтетическая работа',
  packageVersion: 'technical-document-v1',
  revision: 3,
  inputRevision: 1,
  confirmedRevision: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const unused = () => Promise.reject(new Error('UNUSED'));

// Заглушки: порты записывают вызовы в журнал. Транзакция здесь не открывает хранилище.
function ports(calls: string[]): {
  works: WorksPorts;
  facts: { commands: FactsModule['commands'] };
} {
  return {
    works: {
      commands: {
        create: unused,
        attachDocument: unused,
        bumpRevision: (_scope, input) => {
          calls.push(`revision:${input.confirmed ? 'confirmed' : 'draft'}`);
          return Promise.resolve();
        },
        recordEvent: (_scope, input) => {
          calls.push(`event:${input.kind}`);
          return Promise.resolve();
        },
      },
      queries: {
        list: unused,
        find: () => Promise.resolve(work),
        sources: () =>
          Promise.resolve({ documents: [], cleanupPending: false }),
        cursor: unused,
        events: unused,
      },
    },
    facts: {
      commands: {
        edit: () => {
          calls.push('facts:edit');
          return Promise.resolve();
        },
        confirm: unused,
      },
    },
  };
}

function scenario(calls: string[]) {
  const built = ports(calls);
  const worksModule: WorksModule = { ...built.works, in: () => built.works };
  const factsModule: FactsModule = {
    commands: built.facts.commands,
    queries: { get: unused },
    in: () => ({ commands: built.facts.commands, queries: { get: unused } }),
  };
  return {
    edit: editValues({
      uow: { run: (operation) => operation(openTransaction({})) },
      works: worksModule,
      facts: factsModule,
      locks: {
        run: (_key, operation) => operation(new AbortController().signal),
      },
    }),
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

test('a stale revision is a conflict: neither facts nor the revision change', async () => {
  const calls: string[] = [];
  const { edit } = scenario(calls);
  expect(
    await failureOf(
      edit(memberScope(WORKSPACE), {
        workId: WORK_ID,
        revision: 2,
        values: emptyFacts().values,
      }),
    ),
  ).toBe('REVISION_CONFLICT');
  expect(calls).toEqual([]);
});

test('the current revision saves the facts, bumps the revision and records one event', async () => {
  const calls: string[] = [];
  const { edit } = scenario(calls);
  await edit(memberScope(WORKSPACE), {
    workId: WORK_ID,
    revision: 3,
    values: emptyFacts().values,
  });
  expect(calls).toEqual([
    'facts:edit',
    'revision:draft',
    'event:facts.changed',
  ]);
});
