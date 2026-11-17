import { mock } from 'bun:test';

import { type AnchorHTMLAttributes, createElement, forwardRef } from 'react';

// Общая подмена маршрутизатора Next для web-тестов. Импортируйте этот модуль раньше
// модулей, которые используют next/navigation или next/link: подмена действует при загрузке.
export type NavigationCall =
  { method: 'push' | 'replace'; href: string } | { method: 'refresh' };

export const navigation = {
  pathname: '/',
  search: '',
  params: {} as Record<string, string>,
  calls: [] as NavigationCall[],
  reset() {
    this.pathname = '/';
    this.search = '';
    this.params = {};
    this.calls = [];
  },
};

await mock.module('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({
    push: (href: string) => {
      navigation.calls.push({ method: 'push', href });
    },
    replace: (href: string) => {
      navigation.calls.push({ method: 'replace', href });
    },
    refresh: () => {
      navigation.calls.push({ method: 'refresh' });
    },
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
  }),
}));

await mock.module('next/link', () => ({
  default: forwardRef<
    HTMLAnchorElement,
    AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function MockLink({ href, ...props }, ref) {
    return createElement('a', { ...props, href, ref });
  }),
}));
