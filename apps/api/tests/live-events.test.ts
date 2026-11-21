import { expect, mock, test } from 'bun:test';

import { brandWorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import { type SubscribeDatabaseEvents, WorkError } from '@anyko/backend/works';

import { workEventStream } from '../src/http/routes/works/events';
import { workspaceEventStream } from '../src/http/routes/works/workspace-events';

import { stubHttpOptions } from './support/stub-http';

function signals() {
  let receive: Parameters<SubscribeDatabaseEvents>[0] | undefined;
  const subscribe: SubscribeDatabaseEvents = (listener) => {
    receive = listener;
    return () => {
      receive = undefined;
    };
  };
  return {
    subscribe,
    emit: (event: Parameters<NonNullable<typeof receive>>[0]) =>
      receive?.(event),
  };
}

const scope = (rights: string[]) =>
  ({
    workspaceId: 'live',
    userId: 'user',
    has: (right: string) => rights.includes(right),
  }) as WorkspaceScope;

async function waitForFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  match: string,
) {
  const decoder = new TextDecoder();
  let transcript = '';
  while (!transcript.includes(match)) {
    const { done, value } = await reader.read();
    if (done) throw new Error('STREAM_ENDED');
    transcript += decoder.decode(value, { stream: true });
  }
  return transcript;
}

function streamReader(response: Response) {
  if (!response.body) throw new Error('EXPECTED_EVENT_STREAM');
  return response.body.getReader();
}

test('work SSE leaves the journal and Redis idle, then delivers a change and catches up by cursor', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const workId = brandWorkId(crypto.randomUUID());
  const journal: { id: string; kind: string }[] = [];
  const events = mock((_scope: WorkspaceScope, _id: string, after: string) =>
    Promise.resolve(journal.filter(({ id }) => BigInt(id) > BigInt(after))),
  );
  const active = mock(() => Promise.resolve(null));
  const progress = mock(() => Promise.resolve());
  const response = workEventStream({
    request: new Request('http://localhost/events'),
    scope: scope(['works.read']),
    workId,
    after: '0',
    chatAfter: '0-0',
    works: {
      ...workHttp.works,
      queries: { ...workHttp.works.queries, events },
    },
    access: workHttp.access,
    chat: { ...workHttp.chat, progress, progressRun: active },
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    await waitForFrame(reader, 'connected');
    await Bun.sleep(1200);
    expect(events).toHaveBeenCalledTimes(1);
    expect(progress).not.toHaveBeenCalled();
    const started = performance.now();
    journal.push({ id: '1', kind: 'processing.queued' });
    bus.emit({ workspaceId: 'live', workId, kind: 'work' });
    expect(await waitForFrame(reader, 'processing.queued')).toContain('id: 1');
    expect(performance.now() - started).toBeLessThan(1000);
    bus.emit('unavailable');
    journal.push({ id: '2', kind: 'chat.checkpoint' });
    bus.emit(null);
    expect(await waitForFrame(reader, 'chat.checkpoint')).toContain('id: 2');
    expect(events.mock.calls.at(-1)?.[2]).toBe('1');
  } finally {
    await reader.cancel();
  }
});

test('workspace SSE filters notifications by workspace and resource rights', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const response = workspaceEventStream({
    request: new Request('http://localhost/events'),
    scope: scope(['recognitions.use']),
    access: workHttp.access,
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    bus.emit({ workspaceId: 'live', workId: 'hidden', kind: 'work' });
    bus.emit({
      workspaceId: 'other',
      documentId: 'private',
      kind: 'recognition',
    });
    bus.emit({
      workspaceId: 'live',
      documentId: 'visible',
      kind: 'recognition',
    });
    const events = await waitForFrame(reader, 'visible');
    expect(events).not.toContain('work-list');
    expect(events).not.toContain('hidden');
    expect(events).not.toContain('private');
  } finally {
    await reader.cancel();
  }
});

test('revoking work access closes an idle SSE within 15 seconds', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const previous = scope(['works.read']);
  const current = scope(['recognitions.use']);
  const session = {} as NonNullable<
    Awaited<ReturnType<typeof workHttp.access.session>>
  >;
  const response = workEventStream({
    request: new Request('http://localhost/events'),
    scope: previous,
    workId: brandWorkId(crypto.randomUUID()),
    after: '0',
    chatAfter: '0-0',
    works: {
      ...workHttp.works,
      queries: { ...workHttp.works.queries, events: () => Promise.resolve([]) },
    },
    access: {
      ...workHttp.access,
      session: () => Promise.resolve(session),
      scope: () => current,
    },
    chat: workHttp.chat,
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    const started = performance.now();
    await waitForFrame(reader, 'connected');
    while (!(await reader.read()).done) {
      // Ignore heartbeat frames until the access check closes the stream.
    }
    expect(performance.now() - started).toBeLessThan(15000);
  } finally {
    await reader.cancel();
  }
}, 17000);

test('work SSE reconnects Redis independently and sends deltas only from the active run', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const workId = brandWorkId(crypto.randomUUID());
  const runId = crypto.randomUUID();
  const ended = Promise.withResolvers<undefined>();
  const progress: NonNullable<typeof workHttp.chat.progress> = (
    _scope,
    _id,
    _after,
    signal,
    receive,
  ) => {
    if (++attempts === 1) return Promise.reject(new Error('Redis unavailable'));
    signal.addEventListener(
      'abort',
      () => {
        ended.resolve(undefined);
      },
      { once: true },
    );
    receive([]);
    receive([
      {
        id: '1-0',
        delta: {
          runId: crypto.randomUUID(),
          sequence: 1,
          attempt: 1,
          text: 'old-erased-text',
          reasoning: 'old-erased-reasoning',
        },
      },
      {
        id: '2-0',
        delta: {
          runId,
          sequence: 1,
          attempt: 1,
          text: 'current-delta',
          reasoning: '',
        },
      },
    ]);
    return ended.promise;
  };
  let attempts = 0;
  const response = workEventStream({
    request: new Request('http://localhost/events'),
    scope: scope(['works.read']),
    workId,
    after: '0',
    chatAfter: '0-0',
    works: {
      ...workHttp.works,
      queries: { ...workHttp.works.queries, events: () => Promise.resolve([]) },
    },
    access: workHttp.access,
    chat: {
      ...workHttp.chat,
      progress,
      progressRun: () => Promise.resolve(runId),
    },
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    bus.emit(null);
    const transcript = await waitForFrame(reader, 'current-delta');
    expect(transcript).toContain('event: degraded');
    expect(transcript).toContain('event: ready');
    expect(transcript).not.toContain('old-erased');
    expect(transcript).toContain('id: 0|2-0');
    expect(attempts).toBe(2);
  } finally {
    await reader.cancel();
  }
});

test('deleting an active work closes its SSE and prevents Redis from replaying old deltas on retry', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const workId = brandWorkId(crypto.randomUUID());
  let deleted = false;
  const firstRead = Promise.withResolvers<null>();
  const progress = mock(() => {
    firstRead.resolve(null);
    return Promise.reject(new Error('Redis unavailable'));
  });
  const response = workEventStream({
    request: new Request('http://localhost/events'),
    scope: scope(['works.read']),
    workId,
    after: '0',
    chatAfter: '0-0',
    works: {
      ...workHttp.works,
      queries: {
        ...workHttp.works.queries,
        events: () =>
          deleted
            ? Promise.reject(new WorkError('NOT_FOUND'))
            : Promise.resolve([]),
      },
    },
    access: workHttp.access,
    chat: {
      ...workHttp.chat,
      progress,
      progressRun: () => Promise.resolve(deleted ? null : 'active-run'),
    },
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    await firstRead.promise;
    deleted = true;
    bus.emit({ workspaceId: 'live', workId, kind: 'work' });
    expect(await waitForFrame(reader, 'work.deleting')).not.toContain(
      'chat-progress',
    );
    expect((await reader.read()).done).toBe(true);
    await Bun.sleep(550);
    expect(progress).toHaveBeenCalledTimes(1);
  } finally {
    await reader.cancel();
  }
});

test('a source-removal notification stops buffered Redis deltas before reading the journal', async () => {
  const { workHttp } = stubHttpOptions();
  const bus = signals();
  const workId = brandWorkId(crypto.randomUUID());
  const runId = crypto.randomUUID();
  type Receive = Parameters<NonNullable<typeof workHttp.chat.progress>>[4];
  const started = Promise.withResolvers<Receive>();
  const release = Promise.withResolvers<null>();
  let removing = false;
  const response = workEventStream({
    request: new Request('http://localhost/events'),
    scope: scope(['works.read']),
    workId,
    after: '0',
    chatAfter: '0-0',
    works: {
      ...workHttp.works,
      queries: {
        ...workHttp.works.queries,
        events: async () => {
          if (!removing) return [];
          await release.promise;
          return [{ id: '1', kind: 'sources.deleting' }];
        },
      },
    },
    access: workHttp.access,
    chat: {
      ...workHttp.chat,
      progressRun: () => Promise.resolve(removing ? null : runId),
      progress: (_scope, _work, _after, signal, receive) => {
        started.resolve(receive);
        return new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      },
    },
    subscribeEvents: bus.subscribe,
  });
  const reader = streamReader(response);
  try {
    const receive = await started.promise;
    removing = true;
    bus.emit({
      workspaceId: 'live',
      workId,
      kind: 'work',
      eventKind: 'sources.deleting',
    });
    receive([
      {
        id: '1-0',
        delta: {
          runId,
          attempt: 1,
          sequence: 1,
          text: 'stale-buffered-delta',
          reasoning: '',
        },
      },
    ]);
    release.resolve(null);
    const transcript = await waitForFrame(reader, 'sources.deleting');
    expect(transcript).not.toContain('stale-buffered-delta');
    expect(transcript).toContain('id: 1');
  } finally {
    await reader.cancel();
  }
});
