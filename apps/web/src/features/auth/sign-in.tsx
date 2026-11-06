'use client';

import { type SyntheticEvent, useState } from 'react';

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 15000);
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) {
        setError('Не удалось войти. Проверьте почту и пароль.');
        return;
      }
      onSignedIn();
    } catch {
      setError('Не удалось связаться с сервером. Попробуйте ещё раз.');
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  }
  return (
    <section className="sign-in">
      <h1>Документы под контролем</h1>
      <p>
        Войдите в рабочую область, чтобы загрузить документы и получить
        результат распознавания.
      </p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          Почта
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            disabled={pending}
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={pending} type="submit">
          {pending ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </section>
  );
}
