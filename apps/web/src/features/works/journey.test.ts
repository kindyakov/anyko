import { expect, test } from 'bun:test';

import type { WorkView } from '@anyko/contracts';

import { conflictingFields, stepOf, workStage } from '@/features/works/journey';

const id = () => crypto.randomUUID();
function view(patch: Partial<WorkView> = {}): WorkView {
  return {
    work: {
      id: id(),
      title: 'Работа',
      packageVersion: 'v1',
      revision: 2,
      inputRevision: 1,
      confirmedRevision: null,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    package: {
      id: 'p',
      version: 'v1',
      title: 'Пакет',
      technical: false,
      fields: [],
      documents: [],
    },
    documents: [],
    facts: {
      version: 1,
      values: {} as WorkView['facts']['values'],
      manual: [],
      confirmed: [],
      candidates: [],
    },
    runs: [],
    generations: [],
    cursor: '0',
    cleanupPending: false,
    ...patch,
  };
}
const doc = (createdAt: string) => ({
  id: id(),
  filename: 'passport.png',
  status: 'succeeded' as const,
  createdAt,
});
const run = (
  kind: 'analysis' | 'generation',
  status: WorkView['runs'][number]['status'],
  createdAt: string,
  steps: WorkView['runs'][number]['steps'] = [],
) => ({ id: id(), kind, status, errorCode: null, createdAt, steps });
const step = (status: WorkView['runs'][number]['steps'][number]['status']) => ({
  id: id(),
  stage: 'parsing' as const,
  documentId: null,
  status,
  errorCode: null,
  visuals: [],
});

test('a work without files asks for files; files without extraction are a first run', () => {
  expect(workStage(view())).toEqual({ kind: 'empty' });
  const ready = workStage(
    view({ documents: [doc('2026-11-01T10:01:00.000Z')] }),
  );
  expect(ready).toEqual({ kind: 'ready', pending: 1, first: true });
  expect(stepOf(ready)).toBe('files');
});

test('files added after the last extraction are reported as new, not as a first run', () => {
  const stage = workStage(
    view({
      documents: [
        doc('2026-11-01T10:01:00.000Z'),
        doc('2026-11-01T10:09:00.000Z'),
      ],
      runs: [run('analysis', 'succeeded', '2026-11-01T10:05:00.000Z')],
    }),
  );
  expect(stage).toEqual({ kind: 'ready', pending: 1, first: false });
});

test('a running extraction wins over everything and counts only finished steps', () => {
  const stage = workStage(
    view({
      documents: [doc('2026-11-01T10:09:00.000Z')],
      runs: [
        run('analysis', 'running', '2026-11-01T10:05:00.000Z', [
          step('succeeded'),
          step('failed'),
          step('running'),
          step('queued'),
        ]),
      ],
    }),
  );
  expect(stage).toMatchObject({ kind: 'processing', done: 2, total: 4 });
  expect(stepOf(stage)).toBe('extraction');
});

test('review, confirmation and a generation for the current revision lead to documents', () => {
  const base = {
    documents: [doc('2026-11-01T10:01:00.000Z')],
    runs: [run('analysis', 'partial', '2026-11-01T10:05:00.000Z')],
  };
  expect(workStage(view(base)).kind).toBe('review');
  const confirmed = view(base);
  confirmed.work.confirmedRevision = confirmed.work.revision;
  expect(workStage(confirmed)).toEqual({ kind: 'confirmed' });
  const stale = view({
    ...base,
    generations: [
      {
        id: id(),
        revision: 1,
        confirmed: false,
        status: 'succeeded',
        files: [],
        createdAt: '2026-11-01T10:06:00.000Z',
      },
    ],
  });
  expect(workStage(stale).kind).toBe('review');
  const fresh = view({
    ...base,
    generations: [
      {
        id: id(),
        revision: 2,
        confirmed: false,
        status: 'partial',
        files: [
          {
            id: id(),
            templateVersion: 't',
            title: 'Заявление',
            filename: 'a.docx',
            status: 'succeeded',
            errorCode: null,
          },
          {
            id: id(),
            templateVersion: 't',
            title: 'Опись',
            filename: 'b.docx',
            status: 'failed',
            errorCode: 'DOCUMENT_GENERATION_FAILED',
          },
        ],
        createdAt: '2026-11-01T10:06:00.000Z',
      },
    ],
  });
  expect(workStage(fresh)).toEqual({ kind: 'generated', files: 1 });
  expect(stepOf(workStage(fresh))).toBe('documents');
});

test('conflicts are fields whose extracted variants disagree', () => {
  const evidence = [{ documentId: id(), imagePath: null, quote: 'Иванов' }];
  const conflicts = conflictingFields(
    view({
      facts: {
        version: 1,
        values: {} as WorkView['facts']['values'],
        manual: [],
        confirmed: [],
        candidates: [
          { field: 'lastName', value: 'Иванов', evidence },
          { field: 'lastName', value: 'Иванова', evidence },
          { field: 'firstName', value: 'Иван', evidence },
          { field: 'firstName', value: 'Иван', evidence },
        ],
      },
    }),
  );
  expect([...conflicts]).toEqual(['lastName']);
});
