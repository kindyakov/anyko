import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';
import './globals.css';
import 'katex/dist/katex.min.css';
const onest = localFont({
  src: '../../public/brand/Onest.ttf',
  variable: '--font-onest',
  display: 'swap',
});
const manrope = localFont({
  src: '../../public/brand/Manrope.ttf',
  variable: '--font-manrope',
  display: 'swap',
});
export const metadata = {
  title: 'Anyko — рабочая область',
  description: 'Документы, сведения и источники в одной рабочей области.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${onest.variable} ${manrope.variable} bg-canvas text-ink font-sans antialiased`}
      >
        <div className="isolate">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
