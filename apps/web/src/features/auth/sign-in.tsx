'use client';
import { Form } from '@base-ui/react/form';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { OrbitLoader } from '@/components/ui/orbit-loader';

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
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
    <section
      aria-labelledby="sign-in-title"
      className="relative w-full max-w-[440px] rounded-3xl border border-white/10 bg-black/65 p-7 shadow-[-12px_0_60px_-24px_#db143c70,0_24px_80px_#0008] backdrop-blur-xl sm:p-10 lg:bg-black/55"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-8 bottom-8 -left-px w-px bg-linear-to-b from-transparent via-rose-500/70 to-transparent"
      />
      <h1
        id="sign-in-title"
        className="font-heading text-3xl font-semibold tracking-tight text-white"
      >
        Вход в Anyko
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Продолжите работу с документами
      </p>
      <Form
        className="mt-9 grid gap-6"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <FormField label="Почта">
          <Input
            className="min-h-12 rounded-xl border-white/20 bg-white/[.025] px-4 text-white placeholder:text-zinc-500 hover:border-white/35 focus-visible:border-rose-400 focus-visible:outline-rose-400"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@company.ru"
            required
            disabled={pending}
          />
        </FormField>
        <FormField label="Пароль">
          <div className="relative">
            <Input
              className="min-h-12 rounded-xl border-white/20 bg-white/[.025] px-4 pr-14 text-white placeholder:text-zinc-500 hover:border-white/35 focus-visible:border-rose-400 focus-visible:outline-rose-400"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Введите пароль"
              required
              disabled={pending}
            />
            <Button
              variant="secondary"
              className="absolute top-0.5 right-1 min-h-11 border-transparent bg-transparent px-3 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
              disabled={pending}
              onClick={() => {
                setShowPassword(!showPassword);
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
        </FormField>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/20 bg-rose-950/40 p-3 text-sm leading-6 text-rose-200"
          >
            {error}
          </p>
        )}
        <Button
          disabled={pending}
          type="submit"
          className="mt-1 min-h-12 w-full rounded-xl border-rose-400/30 bg-linear-to-b from-[#ee1643] to-[#cf0b34] text-white shadow-[0_0_24px_#db143c30,inset_0_1px_0_#ffffff20] transition duration-200 hover:shadow-[0_0_32px_#db143c55] active:scale-[.99] motion-reduce:transition-none"
        >
          {pending ? (
            <>
              <OrbitLoader compact label="Выполняется вход" /> Входим…
            </>
          ) : (
            <>
              Войти <ArrowRight size={17} />
            </>
          )}
        </Button>
      </Form>
      <p className="mt-8 max-w-xs text-xs leading-6 text-zinc-500">
        Доступ предоставляется участникам рабочей области.
      </p>
    </section>
  );
}
