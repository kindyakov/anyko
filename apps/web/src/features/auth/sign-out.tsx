'use client';

import { useState } from 'react';

export function SignOut({ onSignedOut }: { onSignedOut: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 15000);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (response.ok) onSignedOut();
      else setError('Не удалось выйти.');
    } catch {
      setError('Не удалось связаться с сервером.');
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="secondary"
        disabled={pending}
        onClick={() => {
          void signOut();
        }}
      >
        {pending ? 'Выходим…' : 'Выйти'}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
