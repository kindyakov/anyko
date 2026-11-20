import { describe, expect, test } from 'bun:test';

import type { WorkView } from '@anyko/contracts/works';

import {
  analysisRuns,
  groupSteps,
  runProgress,
  visionVisuals,
} from './pipeline';

type Run = WorkView['runs'][number];
type Step = Run['steps'][number];

describe('pipeline calculations', () => {
  test('selects analysis runs newest first without changing the input', () => {
    const runs = [
      { kind: 'analysis', createdAt: '2025-01-01' },
      { kind: 'generation', createdAt: '2025-03-01' },
      { kind: 'analysis', createdAt: '2025-02-01' },
    ] as Run[];
    expect(analysisRuns(runs).map((run) => run.createdAt)).toEqual([
      '2025-02-01',
      '2025-01-01',
    ]);
    expect(runs[0]?.createdAt).toBe('2025-01-01');
  });

  test('counts all finished statuses and rounds progress', () => {
    const steps = [
      { status: 'succeeded' },
      { status: 'failed' },
      { status: 'running' },
    ] as Step[];
    expect(runProgress(steps)).toEqual({ done: 2, percent: 67 });
    expect(runProgress([])).toEqual({ done: 0, percent: 0 });
  });

  test('groups steps by document including the shared work group', () => {
    const steps = [
      { documentId: 'a', id: '1' },
      { documentId: null, id: '2' },
      { documentId: 'a', id: '3' },
    ] as Step[];
    expect(
      [...groupSteps(steps)].map(([id, items]) => [
        id,
        items.map((step) => step.id),
      ]),
    ).toEqual([
      ['a', ['1', '3']],
      [null, ['2']],
    ]);
  });

  test('keeps vision visuals with their originating document and stable keys', () => {
    const steps = [
      {
        id: 'one',
        stage: 'vision',
        visuals: [{ path: 'a', description: 'A' }],
      },
      {
        id: 'two',
        stage: 'parsing',
        visuals: [{ path: 'b', description: 'B' }],
      },
    ] as Step[];
    expect(visionVisuals(steps, 'doc')).toEqual([
      { path: 'a', description: 'A', key: 'one-a', documentId: 'doc' },
    ]);
  });
});
