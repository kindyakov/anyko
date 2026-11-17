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
  await page.goto('/w/e2e-north/recognition');
  await page
    .getByLabel('Файлы для распознавания')
    .setInputFiles(resolve('tests/e2e/fixtures/fail.pdf'));
  const row = page.getByRole('listitem').filter({ hasText: 'fail.pdf' });
  await expect(row).toContainText('Не удалось обработать');
  const retry = page.waitForResponse(
    (response) =>
      response.url().endsWith('/retry') &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Повторить' }).click();
  expect((await retry).status()).toBe(202);
  await expect(row).toContainText('Не удалось обработать');
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
  await dialog.getByRole('button', { name: 'Отозвать подключение' }).click();

  await expect(page.getByText('Не настроено', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Отозвать подключение' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Не настроено', { exact: true })).toBeVisible();
});
