import Link from 'next/link';

import { logoClassName, LogoMark } from '@anyko/ui/brand/logo';

// Логотип ведёт по переданному адресу: на входе это корень, в оболочке — список работ.
export function LogoLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="Anyko, главная" className={logoClassName}>
      <LogoMark />
    </Link>
  );
}
