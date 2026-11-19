'use client';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Filter, Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  type SourceFormat,
  sourceFormatSchema,
} from '@anyko/contracts/documents';
import { Button, Input } from '@anyko/ui';

import type { DocumentFilters } from '../../api/queries';

const labels: Record<SourceFormat, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  jpg: 'JPEG / JPG',
  png: 'PNG',
  webp: 'WebP',
  tiff: 'TIFF',
  avif: 'AVIF',
  heif: 'HEIF / HEIC',
};

export function DocumentSearch({
  filters,
  onChange,
  catalog = false,
  empty = false,
}: {
  filters: DocumentFilters;
  onChange: (filters: DocumentFilters) => void;
  catalog?: boolean;
  empty?: boolean;
}) {
  const [name, setName] = useState(filters.q);
  const search = useRef<HTMLInputElement>(null);
  const q = name.trim();
  useEffect(() => {
    if (q === filters.q) return;
    const timer = setTimeout(() => {
      onChange({ ...filters, q });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [q, filters, onChange]);

  const hasFilters = !!filters.q || filters.formats.length > 0;
  function reset() {
    setName('');
    onChange({ q: '', formats: [] });
    if (catalog) search.current?.focus();
  }

  return (
    <>
      <div
        className={
          catalog
            ? 'flex flex-wrap items-center gap-2'
            : 'mb-4 flex flex-wrap items-center gap-3'
        }
      >
        <div
          className={
            catalog
              ? 'relative min-w-36 flex-1'
              : 'relative min-w-48 flex-1 sm:max-w-sm'
          }
        >
          <Search
            aria-hidden
            size={16}
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <Input
            ref={search}
            type="search"
            aria-label="Поиск файлов по имени"
            placeholder="Найти файл"
            className="pl-10"
            value={name}
            maxLength={200}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <Popover.Root>
          <Popover.Trigger render={<Button variant="secondary" />}>
            <Filter size={16} aria-hidden />
            Форматы
            {filters.formats.length
              ? ` (${String(filters.formats.length)})`
              : ''}
            <ChevronDown size={14} aria-hidden />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner className="z-[60]" align="start" sideOffset={8}>
              <Popover.Popup className="bg-surface min-w-44 rounded-2xl border border-white/10 p-2 shadow-xl">
                <fieldset>
                  <legend className="sr-only">Форматы файлов</legend>
                  {sourceFormatSchema.options.map((format) => (
                    <label
                      key={format}
                      className="flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-white/[0.06]"
                    >
                      <input
                        type="checkbox"
                        className="accent-brand-hot size-4"
                        checked={filters.formats.includes(format)}
                        onChange={(event) => {
                          onChange({
                            q,
                            formats: event.target.checked
                              ? [...filters.formats, format]
                              : filters.formats.filter(
                                  (item) => item !== format,
                                ),
                          });
                        }}
                      />
                      {labels[format]}
                    </label>
                  ))}
                </fieldset>
                {catalog && filters.formats.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => {
                      onChange({ q, formats: [] });
                    }}
                  >
                    Сбросить форматы
                  </Button>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        {!catalog && (name || filters.formats.length > 0) && (
          <Button variant="ghost" onClick={reset}>
            Сбросить фильтры
          </Button>
        )}
      </div>
      {empty && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-rose-300">
            <SearchX size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-36" role="status">
            <p className="text-sm font-semibold">
              {hasFilters ? 'Файлы не найдены' : 'Каталог пока пуст'}
            </p>
            <p className="text-muted mt-0.5 text-xs leading-5">
              {hasFilters
                ? 'Попробуйте другое имя или формат.'
                : 'Загрузите файлы в разделе «Распознавание».'}
            </p>
          </div>
          {hasFilters && (
            <Button variant="secondary" size="sm" onClick={reset}>
              {filters.formats.length > 0
                ? 'Сбросить фильтры'
                : 'Очистить поиск'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
