'use client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void signOut();
        }}
      >
        {pending ? 'Выходим…' : 'Выйти'}
      </Button>
      {error && (
        <p
          role="alert"
          className="my-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
