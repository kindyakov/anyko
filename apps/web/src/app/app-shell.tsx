'use client';
import { FolderKanban, ScanText, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import type { z } from 'zod';

import type { sessionResponseSchema } from '@anyko/contracts';

import { DeepSkyBackdrop } from '@/components/cosmos/deep-sky-backdrop';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SignOut } from '@/features/auth';
import { LlmSettings } from '@/features/works';

const navigation = [
  {
    href: '/',
    label: 'Работы',
    hint: 'Дела и комплекты документов',
    Icon: FolderKanban,
  },
  {
    href: '/documents',
    label: 'Распознавание',
    hint: 'Текст из любого файла',
    Icon: ScanText,
  },
] as const;

export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Anyko, главная"
      className="group focus-visible:outline-brand-hot flex w-fit items-center gap-2.5 rounded-lg text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <img
        src="/brand/anyko-mark-source.svg"
        width="32"
        height="32"
        alt=""
        className="transition-transform duration-500 group-hover:-rotate-12"
      />
      anyko
      <span className="bg-brand-hot animate-blink ml-0.5 size-1.5 rounded-full shadow-[0_0_8px_#ff3b62]" />
    </Link>
  );
}

export function AppShell({
  session,
  section,
  onUnauthorized,
  children,
}: {
  session: z.infer<typeof sessionResponseSchema>;
  section: '/' | '/documents';
  onUnauthorized: () => void;
  children: ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const person = session.user.name || session.user.email;
  const settingsButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Настройки пространства"
      title="Настройки пространства"
      onClick={() => {
        setSettingsOpen(true);
      }}
    >
      <Settings2 size={17} />
    </Button>
  );
  return (
    <div className="bg-canvas relative isolate min-h-dvh md:grid md:grid-cols-[264px_minmax(0,1fr)]">
      <DeepSkyBackdrop />
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:p-4"
      >
        К содержимому
      </a>
      <aside className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl md:flex md:h-dvh md:flex-col md:border-r md:border-b-0 md:bg-black/30">
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:h-24 md:px-6">
          <Logo />
          <div className="flex items-center gap-1 md:hidden">
            {settingsButton}
            <SignOut onSignedOut={onUnauthorized} />
          </div>
        </div>
        <nav
          aria-label="Основная навигация"
          className="flex gap-1.5 px-3 pb-3 md:flex-col md:px-4"
        >
          {navigation.map(({ href, label, hint, Icon }) => {
            const active = section === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active && pathname === href ? 'page' : undefined}
                className={`group focus-visible:outline-brand-hot relative flex min-h-11 flex-1 items-center gap-3 overflow-hidden rounded-xl px-3 py-2 transition-[background-color,color] duration-200 focus-visible:outline-2 md:flex-none md:py-2.5 ${active ? 'text-ink bg-[linear-gradient(90deg,#db143c26,#db143c08_70%,transparent)]' : 'text-muted hover:text-ink hover:bg-white/[0.04]'}`}
              >
                <span
                  aria-hidden
                  className={`bg-brand-hot absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full shadow-[0_0_12px_#ff3b62] transition-transform duration-300 ${active ? 'scale-y-100' : 'scale-y-0'}`}
                />
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg border transition-colors ${active ? 'border-brand/40 bg-brand/15 text-brand-hot' : 'border-white/[0.06] bg-white/[0.02] group-hover:border-white/15'}`}
                >
                  <Icon size={17} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="text-muted hidden text-[11px] leading-4 md:block">
                    {hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden p-4 md:block">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center gap-3">
              <span className="font-heading grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#db143c,#5b0a1d)] text-sm font-bold text-white shadow-[0_0_20px_-4px_#db143c]">
                {person.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{person}</p>
                <p className="text-muted truncate text-[11px]">
                  {session.workspace.name}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2">
              {settingsButton}
              <SignOut onSignedOut={onUnauthorized} />
            </div>
          </div>
        </div>
      </aside>
      <main
        id="main"
        className="mx-auto w-full max-w-[1480px] min-w-0 px-4 py-6 sm:px-8 sm:py-10 lg:px-10"
      >
        {children}
      </main>
      <Modal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        size="sheet"
        title="Настройки пространства"
        description="Подключение модели, которая читает изображения и извлекает сведения."
        closeLabel="Закрыть настройки"
      >
        <LlmSettings />
      </Modal>
    </div>
  );
}
