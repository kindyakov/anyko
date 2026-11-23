import '../../../../test/next-navigation';
import { afterEach, expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider } from '@anyko/ui';

import { createQueryClient } from '@/lib/api/query-client';

import { installEventSource, json, serveApi } from '../../../../test/api';
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
const firstPageAddress = `${recognitionsAddress}?page=1&pageSize=24`;

function renderWorkspace(onDeletionAccepted?: () => Promise<void>) {
  navigation.params = { workspace: workspaceId };
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <DocumentWorkspace onDeletionAccepted={onDeletionAccepted} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

test('a failed attempt displays the server reason and code once; historical failures stay in the list', async () => {
  const history = {
    ...doc('old', 'старый.pdf', 'failed'),
    processingRevision: 1,
  };
  const queued = {
    ...doc('new', 'новый.docx', 'queued'),
    processingRevision: 1,
  };
  let current: typeof queued & { errorCode?: string; errorMessage?: string } =
    queued;
  serveApi(({ method, url }) => {
    if (method === 'POST' && url === `${recognitionsAddress}/new/retry`) {
      current = { ...current, processingRevision: 2 };
      return json(202, { document: { ...queued, processingRevision: 2 } });
    }
    return json(200, {
      items: [history, current],
      page: 1,
      pageSize: 24,
      total: 2,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  renderWorkspace();
  await screen.findByText('старый.pdf');
  const notifications = within(
    screen.getByRole('region', { name: 'Уведомления' }),
  );
  const description =
    'новый.docx: Вложение WMF нужно заменить на PNG. (OCR_UNSUPPORTED_EMBEDDED_IMAGE)';
  expect(notifications.queryByText('Ошибка распознавания')).toBeNull();
  current = {
    ...queued,
    status: 'failed',
    errorCode: 'OCR_UNSUPPORTED_EMBEDDED_IMAGE',
    errorMessage: 'Вложение WMF нужно заменить на PNG.',
  };
  const refresh = screen.getByRole('button', { name: 'Обновить' });
  await user.click(refresh);
  expect(await notifications.findByText(description)).toBeTruthy();
  await user.click(refresh);
  expect(notifications.getAllByText(description)).toHaveLength(1);

  const retry = screen
    .getAllByRole('listitem')
    .find((element) => within(element).queryByText('новый.docx'));
  if (!retry) throw new Error('Expected the failed recognition row');
  await user.click(within(retry).getByRole('button', { name: 'Повторить' }));
  await waitFor(() => {
    expect(notifications.getAllByText(description)).toHaveLength(2);
  });

  const previousFailure = current;
  current = { ...queued, status: 'running', processingRevision: 3 };
  await user.click(refresh);
  await screen.findByText('Распознаётся: 1');
  current = { ...previousFailure, processingRevision: 3 };
  await user.click(refresh);
  await waitFor(() => {
    expect(notifications.getAllByText(description)).toHaveLength(3);
  });
});

test('the workspace stream refreshes the recognition list on a status change', async () => {
  const sources = installEventSource();
  let listed = {
    items: [doc('d1', 'scan.pdf', 'running')],
    page: 1,
    pageSize: 24,
    total: 1,
    pendingDeletions: [],
  };
  const exchanges = serveApi(() => json(200, listed));
  renderWorkspace();
  expect(await screen.findByText('Распознаётся: 1')).toBeTruthy();
  expect(sources[0]?.url).toBe(`/api/v1/workspaces/${workspaceId}/events`);
  expect(exchanges).toHaveLength(1);
  listed = { ...listed, items: [doc('d1', 'scan.pdf', 'succeeded')] };
  act(() => {
    sources[0]?.emit('changed', { kind: 'recognition', documentId: 'd1' });
  });
  await waitFor(() => {
    expect(exchanges).toHaveLength(2);
    expect(screen.queryByText('Распознаётся: 1')).toBeNull();
  });
});

test('each file of a multi-file upload gets its own idempotency key', async () => {
  const exchanges = serveApi((exchange) =>
    exchange.method === 'GET'
      ? json(200, {
          items: [],
          page: 1,
          pageSize: 24,
          total: 0,
          pendingDeletions: [],
        })
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
  expect(
    await within(
      screen.getByRole('region', { name: 'Уведомления' }),
    ).findByText('Файлы отправлены на распознавание'),
  ).toBeTruthy();
});

test('only server-confirmed recognition uploads contribute to the receipt', async () => {
  serveApi((exchange) => {
    if (exchange.method === 'GET')
      return json(200, {
        items: [],
        page: 1,
        pageSize: 24,
        total: 0,
        pendingDeletions: [],
      });
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
  const notices = within(screen.getByRole('region', { name: 'Уведомления' }));
  expect(await notices.findByText(/bad\.pdf:/)).toBeTruthy();

  await user.upload(input, [
    new File(['bad'], 'bad-again.pdf', { type: 'application/pdf' }),
  ]);
  expect(await notices.findByText(/bad-again\.pdf:/)).toBeTruthy();
  expect(screen.queryByText(/Принято \d/)).toBeNull();
});

const deletionImpactToken = 'a'.repeat(64);

test('a deletion that is still pending stops polling when the screen leaves the page', async () => {
  const exchanges = serveApi((exchange) => {
    if (exchange.method === 'DELETE') return json(202, { status: 'deleting' });
    if (exchange.url.endsWith('/deletion-impact'))
      return json(200, {
        token: deletionImpactToken,
        canDelete: true,
        works: [],
      });
    if (exchange.url.endsWith('/deletion'))
      return json(200, { status: 'deleting' });
    return json(200, {
      items: [doc('d1', 'scan.pdf', 'succeeded')],
      page: 1,
      pageSize: 24,
      total: 1,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  const view = renderWorkspace();
  await user.click(
    await screen.findByRole('button', { name: 'Удалить scan.pdf' }),
  );
  const confirm = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Удалить документ',
  });
  await waitFor(() => {
    expect(confirm.disabled).toBe(false);
  });
  await user.click(confirm);

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
    ...doc('old', 'scan.pdf', 'failed'),
    errorCode: 'OCR_RETRY_REQUIRED',
  };
  const address = `${recognitionsAddress}/old`;
  const exchanges = serveApi(({ method, url }) => {
    if (url === `${address}/source`)
      return json(404, { error: { code: 'NOT_FOUND', requestId: 'source' } });
    if (url === `${address}/result`)
      return json(409, { error: { code: 'NOT_READY', requestId: 'ocr' } });
    if (method === 'POST' && url === `${address}/retry`) {
      document = { ...document, status: 'queued', errorCode: '' };
      return json(202, { document });
    }
    return json(200, {
      items: [document],
      page: 1,
      pageSize: 24,
      total: 1,
      pendingDeletions: [],
    });
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
    await screen.findByRole('dialog', { name: 'scan.pdf' }),
  );
  expect(
    await preview.findByText('Документ нужно распознать заново'),
  ).toBeTruthy();
  expect(
    preview.getByRole('link', { name: 'Оригинал в новой вкладке' }),
  ).toBeTruthy();
  expect(
    preview
      .getByRole('switch', { name: 'Синхронная прокрутка' })
      .getAttribute('aria-disabled'),
  ).toBe('true');
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(preview.getByRole('button', { name: 'Повторить' }));

  expect(await screen.findByText('В очереди')).toBeTruthy();
  expect(
    exchanges
      .filter(({ url }) => url !== `${address}/source`)
      .slice(0, 4)
      .map(({ method, url }) => [method, url]),
  ).toEqual([
    ['GET', firstPageAddress],
    ['GET', `${address}/result`],
    ['POST', `${address}/retry`],
    ['GET', firstPageAddress],
  ]);
});

test('a DOCX source error keeps the extracted text and the original download available', async () => {
  const address = `${recognitionsAddress}/word`;
  const exchanges = serveApi(({ url }) => {
    if (url === `${address}/source`)
      return json(404, { error: { code: 'NOT_FOUND', requestId: 'source' } });
    if (url === `${address}/result`)
      return json(200, {
        markdown: 'Извлечённый текст',
        processorVersion: 'fixture',
      });
    return json(200, {
      items: [doc('word', 'sample.docx', 'succeeded')],
      page: 1,
      pageSize: 24,
      total: 1,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  renderWorkspace();
  await user.click(await screen.findByRole('button', { name: 'Открыть' }));
  const preview = within(
    await screen.findByRole('dialog', { name: 'sample.docx' }),
  );

  expect(await preview.findByText('Не удалось показать DOCX')).toBeTruthy();
  expect(await preview.findByText('Извлечённый текст')).toBeTruthy();
  expect(
    preview
      .getByRole('link', { name: 'Скачать оригинал' })
      .getAttribute('href'),
  ).toBe(`${address}/source`);
  expect(
    exchanges.filter(({ url }) => url === `${address}/source`),
  ).toHaveLength(1);
});

test('a HEIC recognition uses the JPEG preview and keeps the original download', async () => {
  const address = `${recognitionsAddress}/photo`;
  serveApi(({ url }) => {
    if (url === `${address}/result`)
      return json(200, {
        markdown: 'Распознанный текст',
        processorVersion: 'fixture',
        images: [
          { path: 'images/anyko-source-000.jpg', url: `${address}/images/0` },
        ],
      });
    return json(200, {
      items: [doc('photo', 'photo.HEIC', 'succeeded')],
      page: 1,
      pageSize: 24,
      total: 1,
      pendingDeletions: [],
    });
  });

  const user = userEvent.setup();
  renderWorkspace();
  await user.click(await screen.findByRole('button', { name: 'Открыть' }));
  const preview = within(
    await screen.findByRole('dialog', { name: 'photo.HEIC' }),
  );
  const image = await preview.findByRole('img', {
    name: 'Оригинал: photo.HEIC',
  });
  expect(image.getAttribute('src')).toBe(`${address}/images/0`);
  const link = preview.getByRole('link', { name: 'Скачать оригинал' });
  expect(link.hasAttribute('download')).toBe(true);
  expect(link.getAttribute('href')).toBe(`${address}/source`);
});

test('bulk retry runs only for selected failed files and reports partial success', async () => {
  const documents = [
    doc('first', 'first.pdf', 'failed'),
    doc('second', 'second.pdf', 'failed'),
    doc('ready', 'ready.pdf', 'succeeded'),
    doc('unselected', 'unselected.pdf', 'failed'),
  ];
  const exchanges = serveApi(({ method, url }) => {
    if (method !== 'POST')
      return json(200, {
        items: documents,
        page: 1,
        pageSize: 24,
        total: documents.length,
        pendingDeletions: [],
      });
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
    await screen.findByRole('checkbox', {
      name: 'Выбрать все файлы на странице',
    }),
  );
  expect(screen.getByText('Выбрано: 4')).toBeTruthy();
  await user.click(
    screen.getByRole('checkbox', { name: 'Выбрать unselected.pdf' }),
  );
  expect(
    screen
      .getByRole('checkbox', { name: 'Выбрать все файлы на странице' })
      .getAttribute('aria-checked'),
  ).toBe('mixed');
  await user.click(
    screen.getByRole('button', { name: 'Повторить распознавание (2)' }),
  );

  const report = within(screen.getByRole('region', { name: 'Уведомления' }));
  expect(
    await report.findByText('Повторное распознавание запущено: 1 из 2'),
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
  const address = `/api/v1/workspaces/${workspaceId}/recognition-deletions`;
  const firstId = crypto.randomUUID();
  const secondId = crypto.randomUUID();
  const ids = [firstId, secondId];
  const selection = ids.map((documentId) => ({
    documentId,
    impact: deletionImpactToken,
  }));
  let documents = [
    doc(firstId, 'first.pdf', 'failed'),
    doc(secondId, 'second.pdf', 'succeeded'),
    doc('kept', 'kept.pdf', 'succeeded'),
  ];
  const exchanges = serveApi(({ method, url, body }) => {
    if (method === 'POST' && url === address) {
      expect(body).toEqual({ documents: selection });
      documents = documents.filter(({ id }) => !ids.includes(id));
      return json(202, {
        results: ids.map((documentId) => ({ documentId, status: 'deleting' })),
      });
    }
    if (url.startsWith(`${address}/deletion-impact?`))
      return json(200, {
        impacts: ids.map((documentId) => ({
          documentId,
          token: deletionImpactToken,
          canDelete: true,
          works: [],
        })),
      });
    if (url.startsWith(`${address}?`))
      return json(200, {
        results: ids.map((documentId) => ({ documentId, status: 'deleted' })),
      });
    return json(200, {
      items: documents,
      page: 1,
      pageSize: 24,
      total: documents.length,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  let refreshes = 0;
  renderWorkspace(() => {
    refreshes++;
    return Promise.resolve();
  });

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
  expect(exchanges.some(({ method }) => method === 'POST')).toBe(false);
  expect(refreshes).toBe(0);
  expect(screen.getByText('Выбрано: 2')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Удалить выбранные' }));
  const confirm = () =>
    dialog().getByRole<HTMLButtonElement>('button', {
      name: 'Удалить файлы',
    });
  await waitFor(() => {
    expect(confirm().disabled).toBe(false);
  });
  await user.click(confirm());

  const notices = within(screen.getByRole('region', { name: 'Уведомления' }));
  expect(await notices.findByText('Удалено: 2 из 2')).toBeTruthy();
  expect(refreshes).toBe(1);
  expect(
    exchanges.filter(({ method }) => method === 'POST').map(({ url }) => url),
  ).toEqual([address]);
  expect(exchanges.some(({ method }) => method === 'DELETE')).toBe(false);
  expect(
    exchanges.filter(({ url }) => url.startsWith(`${address}?`)),
  ).toHaveLength(1);
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

test('search and multiple formats return to the first page while selections survive page and filter changes', async () => {
  const exchanges = serveApi(({ url }) => {
    const query = new URL(url, 'http://local.test').searchParams;
    const page = query.get('page') === '2' ? 2 : 1;
    const searched = query.has('q');
    return json(200, {
      items: searched
        ? []
        : page === 2
          ? [doc('d2', 'second.pdf', 'succeeded')]
          : [doc('d1', 'first.pdf', 'succeeded')],
      page: searched ? 1 : page,
      pageSize: 1,
      total: searched ? 0 : 2,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  renderWorkspace();
  await user.click(
    await screen.findByRole('checkbox', { name: 'Выбрать first.pdf' }),
  );
  await user.click(screen.getByRole('button', { name: 'Страница 2' }));
  expect(await screen.findByText('second.pdf')).toBeTruthy();
  expect(screen.queryByText('first.pdf')).toBeNull();
  expect(screen.getByText('Вне страницы: 1')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Страница 2' })
      .getAttribute('aria-current'),
  ).toBe('page');
  expect(exchanges.map(({ url }) => url)).toEqual([
    firstPageAddress,
    recognitionsAddress + '?page=2&pageSize=24',
  ]);
  await user.type(
    screen.getByRole('searchbox', { name: 'Поиск файлов по имени' }),
    'счёт',
  );
  await screen.findByText('Файлы по этим фильтрам не найдены.');
  await user.click(screen.getByRole('button', { name: 'Форматы' }));
  await user.click(screen.getByRole('checkbox', { name: 'PDF' }));
  await user.click(screen.getByRole('checkbox', { name: 'HEIF / HEIC' }));
  await waitFor(() => {
    const request = new URL(exchanges.at(-1)?.url ?? '', 'http://local.test');
    expect(Object.fromEntries(request.searchParams)).toEqual({
      q: 'счёт',
      formats: 'heif,pdf',
      page: '1',
      pageSize: '24',
    });
  });
  expect(screen.getByText('Выбрано: 1')).toBeTruthy();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(
    await screen.findByRole('checkbox', {
      name: 'Выбрать first.pdf',
      checked: true,
    }),
  ).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
  await screen.findByText('second.pdf');
  await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
  expect(await screen.findByText('first.pdf')).toBeTruthy();
});

test('a running selection that fails on another page reports the error and can be retried', async () => {
  const running = {
    ...doc('running', 'first.pdf', 'running'),
    processingRevision: 1,
  };
  const failed = {
    ...running,
    status: 'failed',
    errorCode: 'OCR_FAILED',
    errorMessage: 'Распознавание первого файла завершилось ошибкой.',
  };
  serveApi(({ url, method }) => {
    if (method === 'POST' && url === `${recognitionsAddress}/running/retry`)
      return json(202, {
        document: { ...running, status: 'queued', processingRevision: 2 },
      });
    if (url === `${recognitionsAddress}/running`)
      return json(200, { document: failed });
    const first = !url.includes('page=2');
    return json(200, {
      items: first ? [running] : [doc('second', 'second.pdf', 'succeeded')],
      page: first ? 1 : 2,
      pageSize: 1,
      total: 2,
      pendingDeletions: [],
    });
  });
  const user = userEvent.setup();
  renderWorkspace();
  await user.click(
    await screen.findByRole('checkbox', { name: 'Выбрать first.pdf' }),
  );
  await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
  await screen.findByText('second.pdf');
  const notifications = within(
    screen.getByRole('region', { name: 'Уведомления' }),
  );
  expect(
    await notifications.findByText(
      'first.pdf: Распознавание первого файла завершилось ошибкой. (OCR_FAILED)',
    ),
  ).toBeTruthy();
  await user.click(
    screen.getByRole('button', { name: 'Повторить распознавание (1)' }),
  );
  expect(
    await notifications.findByText('Повторное распознавание запущено: 1 из 1'),
  ).toBeTruthy();
});
