import type { ReactNode } from 'react';
import './globals.css';
import 'katex/dist/katex.min.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
