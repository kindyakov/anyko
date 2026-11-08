'use client';
import { LogOut } from 'lucide-react';
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
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Выйти"
        title="Выйти"
        loading={pending}
        onClick={() => {
          void signOut();
        }}
      >
        <LogOut size={17} />
      </Button>
      {error && (
        <p
          role="alert"
          className="animate-rise absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-red-400/25 bg-[#1a0b0e] p-3 text-xs leading-5 text-red-200 shadow-xl"
        >
          {error}
        </p>
      )}
    </div>
  );
}
