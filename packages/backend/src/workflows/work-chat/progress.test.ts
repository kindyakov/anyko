import { expect, mock, test } from 'bun:test';

import type { ChatProgress } from '../../modules/agents';

import { createChatProgressWriter } from './progress';

test('a failed Redis append retries the same fragment before publishing later text', async () => {
  const published: ChatProgress[] = [];
  const firstPublished = Promise.withResolvers<null>();
  const secondFailed = Promise.withResolvers<null>();
  const thirdPublished = Promise.withResolvers<null>();
  let failSecond = true;
  const append = mock((_scope: unknown, delta: ChatProgress) => {
    if (delta.sequence === 2 && failSecond) {
      failSecond = false;
      secondFailed.resolve(null);
      return Promise.reject(new Error('Redis connection dropped'));
    }
    published.push(delta);
    if (delta.sequence === 1) firstPublished.resolve(null);
    if (delta.sequence === 3) thirdPublished.resolve(null);
    return Promise.resolve();
  });
  const writer = createChatProgressWriter({
    scope: { workspaceId: 'workspace', workId: 'work' },
    feed: {
      append,
      subscribe: () => Promise.resolve(),
      erase: () => Promise.resolve(),
    },
    runId: 'run',
    attempt: 1,
    signal: new AbortController().signal,
    checkpoint: () => Promise.resolve(),
  });
  try {
    writer.push({ text: 'A', reasoning: '' });
    await firstPublished.promise;
    writer.push({ text: 'B', reasoning: 'thought' });
    await secondFailed.promise;
    writer.push({ text: 'C', reasoning: '' });
    await thirdPublished.promise;
    expect(append.mock.calls.map(([, { sequence }]) => sequence)).toEqual([
      1, 2, 2, 3,
    ]);
    expect(
      published.map(({ sequence, text, reasoning }) => [
        sequence,
        text,
        reasoning,
      ]),
    ).toEqual([
      [1, 'A', ''],
      [2, 'B', 'thought'],
      [3, 'C', ''],
    ]);
  } finally {
    await writer.close();
  }
});
