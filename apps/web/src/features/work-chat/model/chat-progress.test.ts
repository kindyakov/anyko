import { expect, test } from 'bun:test';

import type { ChatProgress, WorkChatTimeline } from '@anyko/contracts/works';

import { withChatProgress } from './chat-progress';

test('a missing delta requests recovery and a newer snapshot bridges the gap', () => {
  const entry: WorkChatTimeline['items'][number] = {
    runId: 'run',
    kind: 'chat',
    status: 'running',
    attempt: 2,
    createdAt: '2026-11-21T00:00:00Z',
    userText: 'Проверьте сведения.',
    answer: null,
    errorCode: null,
  };
  const delta = (
    sequence: number,
    text: string,
    reasoning = '',
  ): ChatProgress => ({
    runId: entry.runId,
    attempt: 2,
    sequence,
    text,
    reasoning,
  });
  const first = delta(1, 'A');
  const third = delta(3, 'C', 'Ответ.');
  const deltas = [first, third, third];
  const interrupted = withChatProgress(entry, deltas);
  expect(interrupted.entry.answer).toBe('A');
  expect(interrupted.gap).toBe('run:2:2');

  const recovered = withChatProgress(
    {
      ...entry,
      draft: delta(2, 'AB', 'Проверка. '),
    },
    deltas,
  );
  expect(recovered.gap).toBeUndefined();
  expect(recovered.entry).toMatchObject({
    answer: 'ABC',
    reasoning: 'Проверка. Ответ.',
  });
});
