import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { workPageSizes } from '@anyko/contracts/works';
import { Button, buttonStyles } from '@anyko/ui';

const pageSizeOptions = workPageSizes.map((size) => ({
  value: size,
  label: String(size),
}));

export function WorkPagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const count = `Найдено работ: ${String(total)}`;

  const pages = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((number) => number >= 1 && number <= last)
    .sort((a, b) => a - b);

  return (
    <div className="mt-6 grid min-h-20 justify-items-center lg:min-h-14">
      <nav
        aria-label="Страницы работ"
        className="bg-surface/95 fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-2xl border border-white/10 p-1.5 shadow-[0_12px_44px_-12px_#000e] backdrop-blur-xl lg:gap-x-3"
      >
        <span className="text-muted text-xs whitespace-nowrap tabular-nums max-[359px]:order-last lg:px-2">
          <span className="hidden lg:inline">{count}</span>
          <span className="lg:hidden">Всего: {total}</span>
        </span>
        <div className="flex items-center gap-0.5 tabular-nums lg:gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Предыдущая страница"
            disabled={page === 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            <ChevronLeft size={18} />
          </Button>
          <span
            className="text-ink px-2 text-sm font-medium lg:hidden"
            aria-current="page"
          >
            {page} <span className="text-muted">/ {last}</span>
          </span>
          <div className="hidden items-center gap-1 lg:flex">
            {pages.map((number, index) => {
              const previous = pages[index - 1] ?? 0;
              return (
                <span key={number} className="inline-flex items-center gap-1">
                  {number - previous > 1 && (
                    <span aria-hidden className="text-muted px-0.5">
                      …
                    </span>
                  )}
                  <Button
                    variant={number === page ? 'primary' : 'ghost'}
                    size="sm"
                    className="min-w-9 px-2"
                    aria-current={number === page ? 'page' : undefined}
                    aria-label={`Страница ${String(number)}`}
                    onClick={() => {
                      if (number !== page) onPage(number);
                    }}
                  >
                    {number}
                  </Button>
                </span>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Следующая страница"
            disabled={page === last}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="border-l border-white/10 pl-1.5 lg:pl-3">
          <Select.Root<number>
            items={pageSizeOptions}
            value={pageSize}
            onValueChange={(size) => {
              if (size !== null && size !== pageSize) onPageSize(size);
            }}
          >
            <Select.Trigger
              aria-label="Работ на странице"
              className={`${buttonStyles({ variant: 'secondary', size: 'sm' })} data-popup-open:border-brand/45 gap-1 px-2 tabular-nums lg:gap-2 lg:px-3`}
            >
              <span className="text-muted lg:hidden">По</span>
              <span className="text-muted hidden lg:inline">Показывать по</span>
              <Select.Value />
              <Select.Icon className="text-muted">
                <ChevronDown size={14} aria-hidden />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner
                side="top"
                sideOffset={8}
                align="end"
                alignItemWithTrigger={false}
                className="z-40 min-w-24"
              >
                <Select.Popup className="bg-surface rounded-xl border border-white/10 p-1 shadow-xl outline-none">
                  <Select.List>
                    {pageSizeOptions.map(({ value, label }) => (
                      <Select.Item
                        key={value}
                        value={value}
                        className="text-muted data-highlighted:text-ink data-selected:text-ink flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm tabular-nums outline-none data-highlighted:bg-white/[0.06]"
                      >
                        <Select.ItemText>{label}</Select.ItemText>
                        <Select.ItemIndicator className="text-brand-hot ml-auto">
                          <Check size={14} aria-hidden />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </nav>
    </div>
  );
}
