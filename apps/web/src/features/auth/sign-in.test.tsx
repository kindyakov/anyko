import { afterEach, expect, test } from 'bun:test';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';

import { expectFocused } from '../../../test/focus';

import { SignIn } from './sign-in';

const originalFetch = globalThis.fetch;

test('server-rendered sign-in cannot submit credentials as URL parameters before hydration', () => {
  const view = renderToStaticMarkup(<SignIn onSignedIn={() => {}} />);
  expect(view).toMatch(/<form\b[^>]*method="post"/);
  expect(view).toMatch(/<fieldset\b[^>]*disabled/);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// The network boundary is replaced; the form, its state and the request it builds are real.
function answerSignIn(status: number) {
  const requests: { url: string; body: unknown }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const body: unknown = JSON.parse(
      typeof init?.body === 'string' ? init.body : 'null',
    );
    requests.push({ url, body });
    return Promise.resolve(
      new Response('{}', {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as typeof fetch;
  return requests;
}

test('shows and hides the password through its accessible button', async () => {
  const user = userEvent.setup();
  render(
    <SignIn
      onSignedIn={() => {
        /* not reached in this test */
      }}
    />,
  );
  expect(screen.getByLabelText('Пароль').getAttribute('type')).toBe('password');
  await user.click(screen.getByRole('button', { name: 'Показать пароль' }));
  expect(screen.getByLabelText('Пароль').getAttribute('type')).toBe('text');
  await user.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
  expect(screen.getByLabelText('Пароль').getAttribute('type')).toBe('password');
});

test('sends the typed credentials and reports a rejected sign-in', async () => {
  const requests = answerSignIn(401);
  let signedIn = 0;
  const user = userEvent.setup();
  render(
    <SignIn
      onSignedIn={() => {
        signedIn += 1;
      }}
    />,
  );
  await user.type(screen.getByLabelText('Почта'), 'user@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'secret-1');
  await user.click(screen.getByRole('button', { name: 'Войти' }));

  await screen.findByRole('alert');
  await screen.findByText('Не удалось войти. Проверьте почту и пароль.');
  expect(signedIn).toBe(0);
  expect(requests).toEqual([
    {
      url: '/api/auth/sign-in/email',
      body: { email: 'user@example.test', password: 'secret-1' },
    },
  ]);
});

test('calls onSignedIn once the server accepts the credentials', async () => {
  answerSignIn(200);
  let signedIn = 0;
  const user = userEvent.setup();
  render(
    <SignIn
      onSignedIn={() => {
        signedIn += 1;
      }}
    />,
  );
  await user.type(screen.getByLabelText('Почта'), 'user@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'secret-1');
  await user.click(screen.getByRole('button', { name: 'Войти' }));

  await waitFor(() => {
    expect(signedIn).toBe(1);
  });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('an empty submit shows the required messages, sends nothing and focuses the email', async () => {
  const requests = answerSignIn(200);
  const user = userEvent.setup();
  render(
    <SignIn
      onSignedIn={() => {
        /* not reached in this test */
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Войти' }));

  expect(await screen.findByText('Введите почту')).toBeTruthy();
  expect(screen.getByText('Введите пароль')).toBeTruthy();
  expect(screen.getByLabelText('Почта').getAttribute('aria-invalid')).toBe(
    'true',
  );
  expectFocused(screen.getByLabelText('Почта'));
  expect(requests).toEqual([]);
});

test('an incorrect address is reported only after the field loses focus', async () => {
  const user = userEvent.setup();
  render(
    <SignIn
      onSignedIn={() => {
        /* not reached in this test */
      }}
    />,
  );
  await user.type(screen.getByLabelText('Почта'), 'user@');
  expect(
    screen.queryByText('Укажите почту в формате name@company.ru'),
  ).toBeNull();

  await user.tab();
  expect(
    await screen.findByText('Укажите почту в формате name@company.ru'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Почта').getAttribute('aria-invalid')).toBe(
    'true',
  );
});
