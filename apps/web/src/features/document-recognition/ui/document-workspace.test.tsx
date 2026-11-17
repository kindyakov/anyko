import '../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createQueryClient } from '@/lib/api/query-client';

import { json, serveApi } from '../../../../test/api';
import { workspaceId } from '../../../../test/fixtures';
import { navigation } from '../../../../test/next-navigation';

import { DocumentWorkspace } from './document-workspace';

afterEach(() => {
  navigation.reset();
});

type Status = 'queued' | 'running' | 'succeeded' | 'failed';

function doc(id: string, filename: string, status: Status) {
  return {
    id,
    filename,
    status,
    createdAt: '2026-11-01T10:00:00.000Z',
  };
}

const recognitionsAddress = `/api/v1/workspaces/${workspaceId}/recognitions`;

function renderWorkspace() {
  navigation.params = { workspace: workspaceId };
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <DocumentWorkspace />
    </QueryClientProvider>,
  );
}

// Опрос идёт раз в 2 секунды, поэтому ожидания тестов выше интервала.
test('the list polls while a document is being recognized and stops once none is left', async () => {
  let listed = {
    documents: [doc('d1', 'scan.pdf', 'running')],
    deletions: [],
  };
  const exchanges = serveApi(() => json(200, listed));
  renderWorkspace();
  expect(await screen.findByText('Распознаётся: 1')).toBeTruthy();

  await waitFor(
    () => {
      expect(exchanges).toHaveLength(2);
    },
    { timeout: 4000 },
  );
  expect(exchanges.map((item) => item.url)).toEqual([
    recognitionsAddress,
    recognitionsAddress,
  ]);

  listed = {
    documents: [doc('d1', 'scan.pdf', 'succeeded')],
    deletions: [],
  };
  await waitFor(
    () => {
      expect(exchanges).toHaveLength(3);
    },
    { timeout: 4000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 2600));
  expect(exchanges).toHaveLength(3);
  expect(screen.queryByText('Распознаётся: 1')).toBeNull();
}, 15000);

test('each file of a multi-file upload gets its own idempotency key', async () => {
  const exchanges = serveApi((exchange) =>
    exchange.method === 'GET'
      ? json(200, { documents: [], deletions: [] })
      : json(202, { document: doc('d1', 'a.pdf', 'queued') }),
  );
  const user = userEvent.setup();
  renderWorkspace();
  await screen.findByText(
    'Здесь появятся загруженные файлы и результаты распознавания.',
  );
  await user.upload(screen.getByLabelText('Файлы для распознавания'), [
    new File(['first'], 'a.pdf', { type: 'application/pdf' }),
    new File(['second'], 'b.pdf', { type: 'application/pdf' }),
  ]);
  await waitFor(() => {
    expect(exchanges.filter((item) => item.method === 'POST')).toHaveLength(2);
  });
  const posts = exchanges.filter((item) => item.method === 'POST');
  expect(posts.map((item) => item.url)).toEqual([
    recognitionsAddress,
    recognitionsAddress,
  ]);
  const [first, second] = posts;
  expect(first?.idempotencyKey).toBeTruthy();
  expect(second?.idempotencyKey).toBeTruthy();
  expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
  const names = posts.map((item) => {
    const file = item.body instanceof FormData ? item.body.get('file') : null;
    return file instanceof File ? file.name : null;
  });
  expect(names).toEqual(['a.pdf', 'b.pdf']);
  expect(await screen.findByText('Принято 2 файла')).toBeTruthy();
});

test('only server-confirmed recognition uploads contribute to the receipt', async () => {
  serveApi((exchange) => {
    if (exchange.method === 'GET')
      return json(200, { documents: [], deletions: [] });
    const file =
      exchange.body instanceof FormData ? exchange.body.get('file') : null;
    return file instanceof File && file.name === 'good.pdf'
      ? json(202, { document: doc('d1', 'good.pdf', 'queued') })
      : json(400, {
          error: { code: 'UNSUPPORTED_DOCUMENT_FORMAT', requestId: 'r1' },
        });
  });
  const user = userEvent.setup();
  renderWorkspace();
  const input = screen.getByLabelText('Файлы для распознавания');

  await user.upload(input, [
    new File(['bad'], 'bad.pdf', { type: 'application/pdf' }),
    new File(['good'], 'good.pdf', { type: 'application/pdf' }),
  ]);
  expect(await screen.findByText('Принято 1 файл')).toBeTruthy();
  expect((await screen.findByRole('alert')).textContent).toContain('bad.pdf');

  await user.upload(input, [
    new File(['bad'], 'bad-again.pdf', { type: 'application/pdf' }),
  ]);
  expect(await screen.findByText(/bad-again\.pdf:/)).toBeTruthy();
  expect(screen.queryByText(/Принято \d/)).toBeNull();
});

test('a deletion that is still pending stops polling when the screen leaves the page', async () => {
  const exchanges = serveApi((exchange) => {
    if (exchange.method === 'DELETE') return json(202, { status: 'deleting' });
    if (exchange.url.endsWith('/deletion'))
      return json(200, { status: 'deleting' });
    return json(200, {
      documents: [doc('d1', 'scan.pdf', 'succeeded')],
      deletions: [],
    });
  });
  const user = userEvent.setup();
  const view = renderWorkspace();
  await user.click(
    await screen.findByRole('button', { name: 'Удалить scan.pdf' }),
  );
  await user.click(screen.getByRole('button', { name: 'Удалить документ' }));

  const polls = () =>
    exchanges.filter((item) => item.url.endsWith('/deletion')).length;
  await waitFor(
    () => {
      expect(polls()).toBeGreaterThanOrEqual(2);
    },
    { timeout: 4000 },
  );
  view.unmount();
  const atLeave = polls();
  await new Promise((resolve) => setTimeout(resolve, 1600));
  expect(polls()).toBe(atLeave);
}, 15000);

test('an old result asks for new recognition and a 409 keeps the preview usable', async () => {
  let document = {
    ...doc('old', 'scan.docx', 'failed'),
    errorCode: 'OCR_RETRY_REQUIRED',
  };
  const address = `${recognitionsAddress}/old`;
  const exchanges = serveApi(({ method, url }) => {
    if (url === `${address}/result`)
      return json(409, { error: { code: 'NOT_READY', requestId: 'ocr' } });
    if (method === 'POST' && url === `${address}/retry`) {
      document = { ...document, status: 'queued', errorCode: '' };
      return json(202, { document });
    }
    return json(200, { documents: [document], deletions: [] });
  });
  const user = userEvent.setup();
  renderWorkspace();

  const row = within(await screen.findByRole('listitem'));
  expect(row.getByText('Документ нужно распознать заново')).toBeTruthy();
  expect(
    row.getByRole('button', { name: 'Повторить' }).hasAttribute('disabled'),
  ).toBe(false);
  await user.click(row.getByRole('button', { name: 'Открыть' }));

  const preview = within(
    await screen.findByRole('dialog', { name: 'scan.docx' }),
  );
  expect(
    await preview.findByText('Документ нужно распознать заново'),
  ).toBeTruthy();
  expect(
    preview.getByRole('link', { name: 'Оригинал в новой вкладке' }),
  ).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(preview.getByRole('button', { name: 'Повторить' }));

  expect(await screen.findByText('В очереди')).toBeTruthy();
  expect(exchanges.slice(0, 4).map(({ method, url }) => [method, url])).toEqual(
    [
      ['GET', recognitionsAddress],
      ['GET', `${address}/result`],
      ['POST', `${address}/retry`],
      ['GET', recognitionsAddress],
    ],
  );
});

test('bulk retry runs only for selected failed files and reports partial success', async () => {
  const documents = [
    doc('first', 'first.pdf', 'failed'),
    doc('second', 'second.pdf', 'failed'),
    doc('ready', 'ready.pdf', 'succeeded'),
    doc('unselected', 'unselected.pdf', 'failed'),
  ];
  const exchanges = serveApi(({ method, url }) => {
    if (method !== 'POST') return json(200, { documents, deletions: [] });
    if (url === `${recognitionsAddress}/first/retry`) {
      const started = doc('first', 'first.pdf', 'queued');
      documents[0] = started;
      return json(202, { document: started });
    }
    return json(403, { error: { code: 'FORBIDDEN', requestId: 'retry' } });
  });
  const user = userEvent.setup();
  renderWorkspace();

  await user.click(
    await screen.findByRole('checkbox', { name: 'Выбрать все файлы' }),
  );
  expect(screen.getByText('Выбрано: 4')).toBeTruthy();
  await user.click(
    screen.getByRole('checkbox', { name: 'Выбрать unselected.pdf' }),
  );
  expect(
    screen
      .getByRole('checkbox', { name: 'Выбрать все файлы' })
      .getAttribute('aria-checked'),
  ).toBe('mixed');
  await user.click(
    screen.getByRole('button', { name: 'Повторить распознавание (2)' }),
  );

  const report = within(await screen.findByRole('alert'));
  expect(
    report.getByText('Повторное распознавание запущено: 1 из 2'),
  ).toBeTruthy();
  expect(report.getByText(/second\.pdf: Недостаточно прав/)).toBeTruthy();
  expect(
    screen.getByRole('checkbox', { name: 'Выбрать first.pdf', checked: false }),
  ).toBeTruthy();
  expect(
    screen.getByRole('checkbox', { name: 'Выбрать second.pdf', checked: true }),
  ).toBeTruthy();
  expect(screen.getByText('В очереди')).toBeTruthy();
  expect(
    exchanges.filter(({ method }) => method === 'POST').map(({ url }) => url),
  ).toEqual([
    `${recognitionsAddress}/first/retry`,
    `${recognitionsAddress}/second/retry`,
  ]);
});

test('bulk deletion confirms the selection before deleting and leaves unselected files', async () => {
  let documents = [
    doc('first', 'first.pdf', 'failed'),
    doc('second', 'second.pdf', 'succeeded'),
    doc('kept', 'kept.pdf', 'succeeded'),
  ];
  const exchanges = serveApi(({ method, url }) => {
    if (method === 'DELETE') {
      documents = documents.filter(
        ({ id }) => url !== `${recognitionsAddress}/${id}`,
      );
      return json(202, { status: 'deleting' });
    }
    if (url.endsWith('/deletion')) return json(200, { status: 'deleted' });
    return json(200, { documents, deletions: [] });
  });
  const user = userEvent.setup();
  renderWorkspace();

  await user.click(
    await screen.findByRole('checkbox', { name: 'Выбрать first.pdf' }),
  );
  await user.click(
    screen.getByRole('checkbox', { name: 'Выбрать second.pdf' }),
  );
  await user.click(screen.getByRole('button', { name: 'Удалить выбранные' }));
  const dialog = () =>
    within(
      screen.getByRole('alertdialog', { name: 'Удалить выбранные файлы (2)?' }),
    );
  await user.click(dialog().getByRole('button', { name: 'Отмена' }));
  expect(exchanges.some(({ method }) => method === 'DELETE')).toBe(false);
  expect(screen.getByText('Выбрано: 2')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Удалить выбранные' }));
  await user.click(dialog().getByRole('button', { name: 'Удалить файлы' }));

  expect(await screen.findByText('Удалено: 2 из 2')).toBeTruthy();
  expect(
    exchanges.filter(({ method }) => method === 'DELETE').map(({ url }) => url),
  ).toEqual([`${recognitionsAddress}/first`, `${recognitionsAddress}/second`]);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(
    screen.getByRole('checkbox', { name: 'Выбрать kept.pdf', checked: false }),
  ).toBeTruthy();
  expect(
    screen.queryByRole('checkbox', { name: 'Выбрать first.pdf' }),
  ).toBeNull();
  expect(
    screen.queryByRole('checkbox', { name: 'Выбрать second.pdf' }),
  ).toBeNull();
});
