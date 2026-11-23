import { expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createQueryClient } from '@/lib/api/query-client';

import { json, serveApi } from '../../../../test/api';
import { workAddress, workId, workspaceId } from '../../../../test/fixtures';

import { DocumentPicker } from './document-picker';

test('keeps available selections when a document becomes unavailable at submission', async () => {
  const first = '970296b8-d7db-4a80-92cf-a9b2daa25297';
  const second = 'd3ae478c-5ab2-4fad-b4cd-aacf4cb3d02e';
  const waiting = '49a12beb-1520-49b7-a23b-446315c03bf5';
  const createdAt = '2026-11-01T10:00:00.000Z';
  let attempts = 0;
  let closed = false;
  const requests = serveApi(({ method }) => {
    if (method === 'GET') {
      return json(200, {
        items: [
          {
            id: first,
            filename: 'годен.pdf',
            createdAt,
            status: 'succeeded',
            readyRevision: 1,
          },
          {
            id: second,
            filename: 'пропал.pdf',
            createdAt,
            status: 'running',
            readyRevision: 1,
          },
          {
            id: waiting,
            filename: 'ждёт.pdf',
            createdAt,
            status: 'queued',
            readyRevision: null,
          },
        ],
        page: 1,
        pageSize: 12,
        total: 3,
        pendingDeletions: [],
      });
    }
    attempts++;
    return attempts === 1
      ? json(409, {
          error: {
            code: 'NOT_READY',
            requestId: 'req',
            fields: [{ path: ['documentIds', 1], code: 'invalid_value' }],
          },
        })
      : json(200, { status: 'attached' });
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DocumentPicker
        workspaceId={workspaceId}
        workId={workId}
        attached={[]}
        onClose={() => {
          closed = true;
        }}
      />
    </QueryClientProvider>,
  );
  await screen.findByText('Ожидается готовый результат');
  expect(
    screen
      .getByRole('checkbox', { name: 'Выбрать ждёт.pdf' })
      .getAttribute('aria-disabled'),
  ).toBe('true');
  await user.click(screen.getByRole('checkbox', { name: 'Выбрать годен.pdf' }));
  await user.click(
    screen.getByRole('checkbox', { name: 'Выбрать пропал.pdf' }),
  );
  await user.click(screen.getByRole('button', { name: 'Добавить файлы' }));
  expect(
    await screen.findByText('Файлы стали недоступны: пропал.pdf.'),
  ).toBeTruthy();
  expect(
    screen.getByRole('checkbox', { name: 'Выбрать годен.pdf', checked: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole('checkbox', {
      name: 'Выбрать пропал.pdf',
      checked: false,
    }),
  ).toBeTruthy();
  expect(closed).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Добавить файлы' }));
  await waitFor(() => {
    expect(closed).toBe(true);
  });
  expect(
    requests
      .filter(({ method }) => method === 'POST')
      .map(({ url, body }) => ({ url, body })),
  ).toEqual([
    { url: `${workAddress}/attach`, body: { documentIds: [first, second] } },
    { url: `${workAddress}/attach`, body: { documentIds: [first] } },
  ]);
});
