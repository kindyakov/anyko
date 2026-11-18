import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { sessionCookieNames } from '@anyko/contracts/session';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function signIn(page: Page, role: 'OWNER' | 'MEMBER' | 'OUTSIDER') {
  await page.getByLabel('Почта').fill(required(`E2E_${role}_EMAIL`));
  await page
    .getByLabel('Пароль', { exact: true })
    .fill(required(`E2E_${role}_PASSWORD`));
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/sign-in');
}

test('sign-in remains usable at a narrow viewport and with the keyboard', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');
  const email = page.getByLabel('Почта', { exact: true });
  await expect(email).toBeEnabled();
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Пароль', { exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('mobile-sign-in.png') });
});

test('sign-in does not expose credentials before hydration', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3030/sign-in');
    await expect(page.getByLabel('Пароль', { exact: true })).toBeDisabled();
    await expect(page.locator('form')).toHaveAttribute('method', 'post');
  } finally {
    await context.close();
  }
});

test('protected address returns after sign-in, legacy routes redirect, and sign-out protects it again', async ({
  page,
}) => {
  await page.goto('/w/e2e-north/recognition');
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await signIn(page, 'OWNER');
  await expect(page).toHaveURL(/\/w\/e2e-north\/recognition$/);
  await page.goto('/documents');
  await expect(page).toHaveURL(/\/w\/e2e-north\/recognition$/);
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto('/w/e2e-north/works');
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test('a forged session cookie does not grant access to a workspace', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: sessionCookieNames[0],
      value: 'invalid-session',
      url: 'http://127.0.0.1:3030',
    },
  ]);
  await page.goto('/w/e2e-north/works');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(
    page.getByRole('heading', { name: 'Вход в Anyko' }),
  ).toBeVisible();
});

test('work goes from list through upload, automatic status and editable facts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.EventSource;
    class ObservedEventSource extends Original {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        this.addEventListener('open', () => {
          Object.assign(window, { __e2eStreamOpen: true });
        });
        this.addEventListener('changed', (event) => {
          const state = window as unknown as { __e2eStreamCursor?: string };
          state.__e2eStreamCursor = event.lastEventId;
        });
      }
    }
    window.EventSource = ObservedEventSource;
  });
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  await expect(page).toHaveURL(/\/w\/e2e-north\/works$/);
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая работа' });
  await dialog.getByLabel('Название работы').fill('E2E проверка работы');
  await dialog.getByRole('button', { name: 'Создать и открыть' }).click();
  await expect(page).toHaveURL(/\/works\/[0-9a-f-]+$/);
  const workUrl = new URL(page.url());
  const workId = workUrl.pathname.split('/').at(-1);
  if (!workId) throw new Error('Work ID missing');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __e2eStreamOpen?: boolean })
            .__e2eStreamOpen ?? false,
      ),
    )
    .toBe(true);
  await page.request.post('http://127.0.0.1:3031/__e2e/ocr/hold');
  const row = page
    .getByRole('region', { name: /Файлы работы/ })
    .getByRole('listitem')
    .filter({ hasText: 'source.pdf' });
  const cursor = await (async () => {
    try {
      await page
        .getByLabel('Файлы клиента')
        .setInputFiles(resolve('tests/e2e/fixtures/source.pdf'));
      await expect(row).toContainText('Распознаётся');
      const response = await page.request.get(
        `http://127.0.0.1:3031/__e2e/ocr/cursor/e2e-north/${workId}`,
      );
      const cursor = ((await response.json()) as { cursor: string }).cursor;
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { __e2eStreamCursor?: string })
                .__e2eStreamCursor ?? '0',
          ),
        )
        .toBe(cursor);
      return cursor;
    } finally {
      await page.request.post('http://127.0.0.1:3031/__e2e/ocr/release');
    }
  })();
  await expect(row).toContainText('Прочитан');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(
          (window as unknown as { __e2eStreamCursor?: string })
            .__e2eStreamCursor ?? '0',
        ),
      ),
    )
    .toBeGreaterThan(Number(cursor));
  await row.getByRole('button', { name: 'Просмотреть source.pdf' }).click();
  await expect(page.getByRole('dialog', { name: 'source.pdf' })).toContainText(
    'Имя: Анна',
  );
  await page.getByRole('button', { name: 'Закрыть просмотр' }).click();
  await page.getByRole('button', { name: 'Извлечь сведения' }).first().click();
  await expect(page.getByText('Проверьте найденные сведения')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Фамилия', exact: true })
    .first()
    .fill('Иванова');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/fields') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('Есть несохранённые правки')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Фамилия', exact: true }).first(),
  ).toHaveValue('Иванова');
  await page.goto(`/works/${workId}`);
  await expect(page).toHaveURL(new RegExp(`/w/e2e-north/works/${workId}$`));
});

test('recognition reports a failed file and allows retry', async ({ page }) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  const listing = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/workspaces/e2e-north/recognitions' &&
      response.request().method() === 'GET',
  );
  await page.goto('/w/e2e-north/recognition');
  const listed = await listing;
  expect(listed.status()).toBe(200);
  const pageBody: unknown = await listed.json();
  expect(pageBody).toHaveProperty('nextCursor');
  expect(pageBody).toMatchObject({
    items: expect.any(Array),
    pendingDeletions: expect.any(Array),
  });
  await page
    .getByLabel('Файлы для распознавания')
    .setInputFiles(resolve('tests/e2e/fixtures/fail.pdf'));
  const row = page.getByRole('listitem').filter({ hasText: 'fail.pdf' });
  await expect(row).toContainText('Не удалось распознать документ');
  const retry = page.waitForResponse(
    (response) =>
      response.url().endsWith('/retry') &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Повторить' }).click();
  expect((await retry).status()).toBe(202);
  await expect(row).toContainText('Не удалось распознать документ');
  const search = page.getByRole('searchbox', { name: 'Поиск файлов по имени' });
  await search.fill('unmatched-e2e-file');
  await expect(
    page.getByText('Файлы по этим фильтрам не найдены.'),
  ).toBeVisible();
  await search.fill('AiL.Pd');
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Форматы' }).click();
  await page.getByRole('checkbox', { name: 'PNG' }).check();
  await expect(
    page.getByText('Файлы по этим фильтрам не найдены.'),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'PDF', exact: true }).check();
  await expect(row).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(search).toHaveValue('');
  await expect(row).toBeVisible();
});

test('the catalog picker attaches sources selected on different pages', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const creation = page.getByRole('dialog', { name: 'Новая работа' });
  await creation.getByLabel('Название работы').fill('E2E подбор из каталога');
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  const open = page.getByRole('button', { name: 'Добавить из каталога' });
  await open.click();
  const picker = page.getByRole('dialog', { name: 'Добавить из каталога' });
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/recognitions') &&
      url.searchParams.get('q') === 'каталог E2E'
    );
  });
  await picker
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill('каталог E2E');
  expect((await filtered).status()).toBe(200);
  await picker
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 50.pdf' })
    .click();
  await picker.getByRole('button', { name: 'Далее' }).click();
  await expect(picker.getByText('Страница 2')).toBeVisible();
  await picker
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 00.pdf' })
    .click();
  await picker.getByRole('button', { name: 'Форматы' }).click();
  await page.getByRole('checkbox', { name: 'PNG' }).check();
  await expect(
    picker.getByText('Файлы по этим фильтрам не найдены.'),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'PDF', exact: true }).check();
  await expect(
    picker.getByRole('checkbox', { name: 'Выбрать Каталог E2E 50.pdf' }),
  ).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(picker.getByText('Выбрано: 2 из 20')).toBeVisible();
  await picker.getByRole('button', { name: 'Добавить файлы' }).click();
  await expect(picker).toBeHidden();
  const sources = page.getByRole('region', { name: /Файлы работы/ });
  await expect(sources.getByText('Каталог E2E 50.pdf')).toBeVisible();
  await expect(sources.getByText('Каталог E2E 00.pdf')).toBeVisible();
  await open.click();
  await picker
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill('Каталог E2E 00');
  await expect(picker.getByText('Уже в работе')).toBeVisible();
  await expect(
    picker.getByRole('checkbox', { name: 'Выбрать Каталог E2E 00.pdf' }),
  ).toBeDisabled();
});

test('ready catalog files can be used when creating and extending a work', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  const title = 'E2E работа из готового распознавания';
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const creation = page.getByRole('dialog', { name: 'Новая работа' });
  await creation.getByLabel('Название работы').fill(title);
  await creation
    .getByRole('button', { name: 'Выбрать файлы из каталога' })
    .click();
  await creation
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill('Каталог E2E 30');
  await creation
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 30.pdf' })
    .click();
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  const sources = page.getByRole('region', { name: /Файлы работы/ });
  await expect(sources.getByText('Каталог E2E 30.pdf')).toBeVisible();
  await page.getByRole('link', { name: /Распознавание/ }).click();
  await page
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill('Каталог E2E 3');
  await page
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 30.pdf' })
    .click();
  await page
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 31.pdf' })
    .click();
  await page.getByRole('button', { name: 'Добавить в работу' }).click();
  const picker = page.getByRole('dialog', { name: 'Добавить в работу' });
  await picker.getByRole('searchbox', { name: 'Поиск работы' }).fill(title);
  await picker.getByRole('button', { name: title }).click();
  await expect(picker.getByText('Уже в работе')).toBeVisible();
  await picker.getByRole('button', { name: 'Добавить файлы' }).click();
  await expect(sources.getByText('Каталог E2E 30.pdf')).toBeVisible();
  await expect(sources.getByText('Каталог E2E 31.pdf')).toBeVisible();
  await page.getByRole('link', { name: /Распознавание/ }).click();
  await page
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill('Каталог E2E 32');
  await page
    .getByRole('checkbox', { name: 'Выбрать Каталог E2E 32.pdf' })
    .click();
  await page.getByRole('button', { name: 'Добавить в работу' }).click();
  await picker.getByRole('button', { name: 'Создать новую работу' }).click();
  await expect(
    creation
      .getByRole('list', { name: 'Выбранные файлы' })
      .getByText('Каталог E2E 32.pdf'),
  ).toBeVisible();
  await creation.getByLabel('Название работы').fill('E2E из распознавания');
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  await expect(sources.getByText('Каталог E2E 32.pdf')).toBeVisible();
});

test('linked catalog deletion shows affected works and requires deliberate confirmation', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  const work = 'E2E удаление связанного источника';
  const filename = 'Каталог E2E 35.pdf';
  const bulkFiles = ['Каталог E2E 36.pdf', 'Каталог E2E 37.pdf'];
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const creation = page.getByRole('dialog', { name: 'Новая работа' });
  await creation.getByLabel('Название работы').fill(work);
  await creation
    .getByRole('button', { name: 'Выбрать файлы из каталога' })
    .click();
  for (const file of [filename, ...bulkFiles]) {
    await creation
      .getByRole('searchbox', { name: 'Поиск файлов по имени' })
      .fill(file);
    await creation.getByRole('checkbox', { name: `Выбрать ${file}` }).click();
  }
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  await expect(
    page.getByRole('region', { name: /Файлы работы/ }).getByText(filename),
  ).toBeVisible();
  await page.getByRole('link', { name: /Распознавание/ }).click();
  await page
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill(filename);
  const remove = page.getByRole('button', { name: `Удалить ${filename}` });
  await remove.click();
  const confirmation = page.getByRole('alertdialog');
  await expect(
    confirmation
      .getByRole('list', { name: 'Затронутые работы' })
      .getByText(work),
  ).toBeVisible();
  const hold = confirmation.getByRole('button', {
    name: 'Удерживайте 3 секунды',
  });
  await hold.hover();
  await page.mouse.down();
  const progress = confirmation.getByRole('progressbar');
  await expect
    .poll(() =>
      progress.evaluate((element) => (element as HTMLProgressElement).value),
    )
    .toBeGreaterThan(0);
  await page.mouse.up();
  await expect(progress).toHaveAttribute('value', '0');
  await confirmation.getByRole('button', { name: 'Отмена' }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  const confirm = confirmation.getByRole('button', {
    name: 'Удалить документ',
  });
  await expect(confirm).toBeDisabled();
  await confirmation
    .getByRole('checkbox', {
      name: 'Подтверждаю удаление из перечисленных работ',
    })
    .check();
  await confirm.click();
  await expect(confirmation).toBeHidden();
  await expect(remove).toBeHidden();
  for (const file of bulkFiles) {
    await page
      .getByRole('searchbox', { name: 'Поиск файлов по имени' })
      .fill(file);
    await page.getByRole('checkbox', { name: `Выбрать ${file}` }).check();
  }
  await page.getByRole('button', { name: 'Удалить выбранные' }).click();
  await hold.hover();
  await page.mouse.down();
  await expect(confirmation).toBeHidden();
  await page.mouse.up();
  await expect(page.getByText('Удалено: 2 из 2')).toBeVisible();
});

test('uploading matching content offers reuse or a separate source in recognition and works', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  await page.getByRole('link', { name: /Распознавание/ }).click();
  const original = 'E2E 46 исходник.pdf';
  const buffer = Buffer.concat([
    await readFile(resolve('tests/e2e/fixtures/source.pdf')),
    Buffer.from('\n% match-46'),
  ]);
  const file = (name: string) => ({
    name,
    buffer,
    mimeType: 'application/pdf',
  });
  const input = page.getByLabel('Файлы для распознавания');
  const wasUploaded = (suffix: string) =>
    page.waitForResponse(
      (response) =>
        response.url().endsWith(suffix) &&
        response.request().method() === 'POST' &&
        response.status() === 202,
    );
  const recognitionCreation = wasUploaded('/recognitions');
  await input.setInputFiles(file(original));
  const first = (await (await recognitionCreation).json()) as {
    document: { id: string };
  };
  const catalog = page.getByRole('list', { name: 'Загруженные файлы' });
  const match = page.getByRole('dialog', { name: 'Такой файл уже есть' });
  await expect(catalog.getByText(original)).toBeVisible();
  await input.setInputFiles(file('E2E 46 другое имя.pdf'));
  await expect(match.getByText(original)).toBeVisible();
  await match
    .getByRole('button', { name: 'Использовать существующий' })
    .click();
  await expect(page.getByText('Использован файл из каталога')).toBeVisible();
  await expect(catalog.getByText('E2E 46 другое имя.pdf')).toHaveCount(0);

  const copy = 'E2E 46 копия из каталога.pdf';
  await input.setInputFiles(file(copy));
  const recognitionCopy = wasUploaded('/recognitions');
  await match.getByRole('button', { name: 'Загрузить отдельно' }).click();
  const separate = (await (await recognitionCopy).json()) as {
    document: { id: string };
  };
  expect(separate.document.id).not.toBe(first.document.id);
  await expect(catalog.getByText(copy)).toBeVisible();

  await page.getByRole('link', { name: /Работы/ }).click();
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const creation = page.getByRole('dialog', { name: 'Новая работа' });
  await creation.getByLabel('Название работы').fill('E2E 46 переиспользование');
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  const workInput = page.getByLabel('Файлы клиента');
  await workInput.setInputFiles(file('E2E 46 не загружен.pdf'));
  await match
    .getByRole('radio', { name: new RegExp(original.replace('.', '\\.')) })
    .check();
  const attached = page.waitForResponse(
    (response) =>
      response.url().endsWith('/attach') && response.status() === 200,
  );
  await match
    .getByRole('button', { name: 'Использовать существующий' })
    .click();
  expect((await attached).request().postDataJSON()).toEqual({
    documentIds: [first.document.id],
  });
  const sources = page.getByRole('region', { name: /Файлы работы/ });
  await expect(sources.getByText(original)).toBeVisible();

  const workCopy = 'E2E 46 копия из работы.pdf';
  await workInput.setInputFiles(file(workCopy));
  await expect(match.getByText('Уже в работе')).toBeVisible();
  const workCreation = wasUploaded('/documents');
  await match.getByRole('button', { name: 'Загрузить отдельно' }).click();
  const uploaded = (await (await workCreation).json()) as {
    document: { id: string };
  };
  expect(uploaded.document.id).not.toBe(first.document.id);
  expect(uploaded.document.id).not.toBe(separate.document.id);
  await expect(sources.getByText(workCopy)).toBeVisible();
});

test('the source stays on its original OCR until the user confirms the update', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const creation = page.getByRole('dialog', { name: 'Новая работа' });
  await creation
    .getByLabel('Название работы')
    .fill('E2E 47 версия распознавания');
  await creation.getByRole('button', { name: 'Создать и открыть' }).click();
  const name = 'e2e-ocr-update.pdf';
  await page.getByLabel('Файлы клиента').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.concat([
      await readFile(resolve('tests/e2e/fixtures/source.pdf')),
      Buffer.from('\n% revision-47'),
    ]),
  });
  const sources = page.getByRole('region', { name: /Файлы работы/ });
  await expect(
    sources.getByText('Версия распознавания 1', { exact: true }),
  ).toBeVisible();
  const address = page.url();
  const openSource = () =>
    sources.getByRole('button', { name: `Просмотреть ${name}` }).click();
  const viewer = page.getByRole('dialog', { name });
  await openSource();
  await expect(viewer.getByText('Текст ревизии 1.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /Распознавание/ }).click();
  await page
    .getByRole('searchbox', { name: 'Поиск файлов по имени' })
    .fill(name);
  const file = page.getByRole('listitem').filter({ hasText: name });
  const queued = page.waitForResponse(
    (response) =>
      response.url().endsWith('/retry') &&
      response.request().method() === 'POST' &&
      response.status() === 202,
  );
  await file.getByRole('button', { name: 'Повторить' }).click();
  await queued;
  await page.goto(address);
  const update = sources.getByRole('button', { name: 'Обновить до версии 2' });
  await expect(update).toBeVisible();
  await expect(
    sources.getByText('Версия распознавания 1', { exact: true }),
  ).toBeVisible();
  await update.click();
  const dialog = page.getByRole('dialog', { name: 'Обновить распознавание?' });
  await dialog.getByRole('button', { name: 'Обновить распознавание' }).click();
  await expect(
    sources.getByText('Версия распознавания 2', { exact: true }),
  ).toBeVisible();
  await expect(update).toHaveCount(0);
  await openSource();
  await expect(viewer.getByText('Текст ревизии 2.')).toBeVisible();
});

test('owner switches areas without seeing the other area works; a member cannot open a foreign area', async ({
  page,
}) => {
  const title = 'E2E работа только для Севера';
  await page.goto('/sign-in');
  await signIn(page, 'OWNER');
  await expect(page).toHaveURL(/\/w\/e2e-north\/works$/);
  await page.getByRole('button', { name: 'Новая работа' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая работа' });
  await dialog.getByLabel('Название работы').fill(title);
  await dialog.getByRole('button', { name: 'Создать и открыть' }).click();
  await expect(page).toHaveURL(/\/w\/e2e-north\/works\/[0-9a-f-]+$/);
  const workId = new URL(page.url()).pathname.split('/').at(-1);
  if (!workId) throw new Error('Work ID missing');

  await page.getByRole('button', { name: 'E2E Север' }).click();
  await page.getByRole('menuitem', { name: 'E2E Юг' }).click();
  await expect(page).toHaveURL(/\/w\/e2e-south\/works$/);
  await expect(page.getByRole('button', { name: 'E2E Юг' })).toBeVisible();
  await expect(page.getByLabel('Список работ загружается')).toHaveCount(0);
  await expect(page.getByText(title)).toHaveCount(0);
  await page.goto(`/w/e2e-south/works/${workId}`);
  await expect(page.getByText('Работа не найдена.')).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, 'MEMBER');
  await expect(page).toHaveURL(/\/w\/e2e-north\/works$/);
  await expect(page.getByRole('button', { name: 'E2E Север' })).toHaveCount(0);
  await page.goto('/w/e2e-south/works');
  await expect(
    page.getByRole('heading', { name: 'Страница не найдена' }),
  ).toBeVisible();
});

test('member has one area and read-only connection settings; outsider has no areas', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await signIn(page, 'MEMBER');
  await expect(page).toHaveURL(/\/w\/e2e-north\/works$/);
  await page.goto('/w/e2e-north/settings/connections');
  await expect(
    page.getByText('Изменять подключение может владелец рабочей области.'),
  ).toBeVisible();
  await expect(page.getByText('Подключено', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Отозвать подключение' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, 'OUTSIDER');
  await expect(page).toHaveURL(/\/no-workspace$/);
  await expect(
    page.getByRole('heading', { name: 'Нет доступа к рабочим областям' }),
  ).toBeVisible();
});

test('an owner revokes the configured connection and sees that it is no longer configured', async ({
  page,
}) => {
  await page.goto('/w/e2e-south/settings/connections');
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await signIn(page, 'OWNER');
  await expect(page).toHaveURL(/\/w\/e2e-south\/settings\/connections$/);
  await expect(page.getByText('Подключено', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Отозвать подключение' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: 'Отозвать подключение модели?',
  });
  const revoked = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/workspaces/e2e-south/connections/llm') &&
      response.request().method() === 'DELETE',
  );
  await dialog.getByRole('button', { name: 'Отозвать подключение' }).click();
  expect((await revoked).status()).toBe(200);

  await expect(page.getByText('Не настроено', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Отозвать подключение' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Не настроено', { exact: true })).toBeVisible();
});
