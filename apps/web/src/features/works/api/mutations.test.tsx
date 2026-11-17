import { expect, test } from 'bun:test';

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { newIdempotencyKey } from '@/lib/api/call';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { createQueryClient } from '@/lib/api/query-client';

import { json, networkError, serveApi } from '../../../../test/api';
import {
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../test/fixtures';

import { useAnalyzeWork, useConfirmWork, useCreateWork } from './mutations';
import { workQueryOptions } from './queries';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

// Экран держит вид работы активным запросом; команда после успеха должна его обновить.
function renderCommands(client: QueryClient) {
  return renderHook(
    () => ({
      view: useQuery(workQueryOptions(workspaceId, workId)),
      analyze: useAnalyzeWork(workspaceId, workId),
      confirm: useConfirmWork(workspaceId, workId),
    }),
    { wrapper: wrapperFor(client) },
  );
}

test('analyze sends its idempotency key, repeats the same key after a network error, and a new click gets a new key', async () => {
  let posts = 0;
  const exchanges = serveApi((exchange) => {
    if (exchange.method === 'GET') return json(200, workView);
    posts++;
    return posts === 1 ? networkError : json(202, { status: 'queued' });
  });
  const { result } = renderCommands(createQueryClient());
  await waitFor(() => {
    expect(result.current.view.data).toBeDefined();
  });

  // Один клик: ключ создан обработчиком и передан в переменных.
  const click = { idempotencyKey: newIdempotencyKey() };
  let failure: unknown;
  await result.current.analyze.mutateAsync(click).catch((error: unknown) => {
    failure = error;
  });
  expect(failure).toMatchObject({ code: 'NETWORK_ERROR' });
  // Повтор той же мутации с теми же переменными — тот же ключ.
  await result.current.analyze.mutateAsync(click);
  // Новое действие пользователя — новый ключ.
  await result.current.analyze.mutateAsync({
    idempotencyKey: newIdempotencyKey(),
  });

  const analyzed = exchanges.filter((item) => item.method === 'POST');
  expect(analyzed.map((item) => item.url)).toEqual([
    `${workAddress}/analyze`,
    `${workAddress}/analyze`,
    `${workAddress}/analyze`,
  ]);
  expect(analyzed[0]?.idempotencyKey).toBe(click.idempotencyKey);
  expect(analyzed[1]?.idempotencyKey).toBe(click.idempotencyKey);
  expect(analyzed[2]?.idempotencyKey).toMatch(uuid);
  expect(analyzed[2]?.idempotencyKey).not.toBe(click.idempotencyKey);
  // Две успешные команды обновили вид работы: одна загрузка при открытии и по одной после каждой.
  expect(exchanges.filter((item) => item.method === 'GET')).toHaveLength(3);
});

test('a command without a key is refused before any request is sent', async () => {
  const exchanges = serveApi(() => json(200, workView));
  const client = createQueryClient();
  const { result } = renderHook(() => useAnalyzeWork(workspaceId, workId), {
    wrapper: wrapperFor(client),
  });
  let failure: unknown;
  await result.current
    .mutateAsync({ idempotencyKey: 'not-a-uuid' })
    .catch((error: unknown) => {
      failure = error;
    });
  expect(failure instanceof Error ? failure.message : '').toContain(
    'Idempotency-Key',
  );
  expect(exchanges).toHaveLength(0);
});

test('confirm sends the revision it was given and no idempotency key, then refreshes the work', async () => {
  const exchanges = serveApi((exchange) =>
    exchange.method === 'GET'
      ? json(200, workView)
      : json(200, {
          ...workView,
          work: { ...workView.work, confirmedRevision: 1 },
        }),
  );
  const { result } = renderCommands(createQueryClient());
  await waitFor(() => {
    expect(result.current.view.data).toBeDefined();
  });
  await result.current.confirm.mutateAsync({ revision: 1 });
  const confirmed = exchanges.find((item) => item.method === 'POST');
  expect(confirmed?.url).toBe(`${workAddress}/confirm`);
  expect(confirmed?.body).toEqual({ revision: 1 });
  expect(confirmed?.idempotencyKey).toBeNull();
  expect(exchanges.filter((item) => item.method === 'GET')).toHaveLength(2);
});

// Повторяет обработчик клика экрана: ключ берётся на клик и закрывается по исходу команды.
test('a repeated click reuses the key after a network error, and starts a new one after success or a refusal', async () => {
  const answers: (Response | typeof networkError)[] = [
    networkError,
    json(202, { status: 'queued' }),
    json(409, {
      error: { code: 'IDEMPOTENCY_CONFLICT', requestId: 'r1' },
    }),
    json(202, { status: 'queued' }),
  ];
  const exchanges = serveApi((exchange) => {
    if (exchange.method === 'GET') return json(200, workView);
    return answers.shift() ?? json(500, {});
  });
  const { result } = renderHook(
    () => ({
      view: useQuery(workQueryOptions(workspaceId, workId)),
      analyze: useAnalyzeWork(workspaceId, workId),
      key: useIdempotencyKey(),
    }),
    { wrapper: wrapperFor(createQueryClient()) },
  );
  await waitFor(() => {
    expect(result.current.view.data).toBeDefined();
  });
  const click = async () => {
    const { analyze, key } = result.current;
    try {
      await analyze.mutateAsync({ idempotencyKey: key.take() });
      key.settle();
    } catch (failure) {
      key.settle(failure);
    }
  };
  await click(); // сетевая ошибка: исход неизвестен
  await click(); // повтор после неизвестного исхода
  await click(); // успех: следующее действие
  await click(); // отказ повтора (конфликт): следующее действие

  const posts = exchanges.filter((item) => item.method === 'POST');
  expect(posts).toHaveLength(4);
  const [first, repeated, afterSuccess, afterConflict] = posts;
  expect(first?.idempotencyKey).toMatch(uuid);
  expect(repeated?.idempotencyKey).toBe(first?.idempotencyKey);
  expect(afterSuccess?.idempotencyKey).not.toBe(repeated?.idempotencyKey);
  expect(afterConflict?.idempotencyKey).not.toBe(afterSuccess?.idempotencyKey);
});

test('creating a work sends the key in its header and only the work fields in the body', async () => {
  const exchanges = serveApi(() => json(201, workView));
  const { result } = renderHook(() => useCreateWork(workspaceId), {
    wrapper: wrapperFor(createQueryClient()),
  });
  const key = newIdempotencyKey();
  await result.current.mutateAsync({
    title: 'Новая работа',
    packageVersion: 'v1',
    idempotencyKey: key,
  });
  const created = exchanges[0];
  expect(created?.url).toBe(`/api/v1/workspaces/${workspaceId}/works`);
  expect(created?.idempotencyKey).toBe(key);
  expect(created?.body).toEqual({
    title: 'Новая работа',
    packageVersion: 'v1',
  });
});
