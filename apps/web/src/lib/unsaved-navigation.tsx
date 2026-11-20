'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Confirm } from '@anyko/ui';

/** Guards internal links; browser Back and programmatic router navigation are not intercepted. */
export function UnsavedNavigation({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const current = window.location.href;
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self')
      )
        return;
      const destination = new URL(link.href, current);
      const here = new URL(current);
      if (
        destination.origin !== here.origin ||
        (destination.pathname === here.pathname &&
          destination.search === here.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPending(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    };
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);

  return (
    <Confirm
      open={pending !== null}
      title="Уйти без сохранения?"
      confirmLabel="Уйти"
      cancelLabel="Остаться"
      pending={false}
      onCancel={() => {
        setPending(null);
      }}
      onConfirm={() => {
        if (!pending) return;
        router.push(pending);
        setPending(null);
      }}
    >
      Несохранённые правки сведений будут потеряны.
    </Confirm>
  );
}
