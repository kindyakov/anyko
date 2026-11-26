'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './button';

/** Постраничная навигация, когда общее число страниц известно. */
export function Pager({
  label,
  page,
  pages,
  disabled = false,
  onPage,
}: {
  label: string;
  /** Номер текущей страницы, начиная с 1. */
  page: number;
  pages: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  if (pages < 2) return null;
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((number) => number >= 1 && number <= pages)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 tabular-nums shadow-[inset_0_1px_0_#ffffff0a] backdrop-blur-md"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Предыдущая страница"
        disabled={disabled || page === 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeft size={18} />
      </Button>
      {numbers.map((number, index) => (
        <span key={number} className="inline-flex items-center gap-1">
          {number - (numbers[index - 1] ?? 0) > 1 && (
            <span aria-hidden className="text-muted px-0.5">
              …
            </span>
          )}
          <Button
            variant={number === page ? 'primary' : 'ghost'}
            size="sm"
            className="min-w-9 px-2"
            disabled={disabled && number !== page}
            aria-current={number === page ? 'page' : undefined}
            aria-label={`Страница ${String(number)}`}
            onClick={() => {
              if (number !== page) onPage(number);
            }}
          >
            {number}
          </Button>
        </span>
      ))}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Следующая страница"
        disabled={disabled || page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        <ChevronRight size={18} />
      </Button>
    </nav>
  );
}
