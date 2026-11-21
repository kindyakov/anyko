import { expect, mock, test } from 'bun:test';

import { brandWorkId } from '@anyko/backend/ids';
import type { WorkspaceScope } from '@anyko/backend/scope';
import type { SubscribeDatabaseEvents } from '@anyko/backend/works';

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
  const active = mock(() => Promise.resolve(false));
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
    chat: { ...workHttp.chat, progress, progressActive: active },
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
