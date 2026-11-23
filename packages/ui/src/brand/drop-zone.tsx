'use client';
import { Input } from '@base-ui/react/input';
import { FileText, ImageIcon, Upload } from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';

import { Button } from '../button';

import { EventHorizon } from './event-horizon';

// Start offsets of files falling into the horizon; reused cyclically.
const orbits = [
  '[--x:-210px] [--y:-70px]',
  '[--x:200px] [--y:-90px] [animation-delay:120ms]',
  '[--x:-170px] [--y:90px] [animation-delay:240ms]',
  '[--x:230px] [--y:60px] [animation-delay:360ms]',
  '[--x:-40px] [--y:-130px] [animation-delay:480ms]',
  '[--x:60px] [--y:120px] [animation-delay:600ms]',
];

interface Flying {
  id: number;
  name: string;
  image: boolean;
}

const filePlural = new Intl.PluralRules('ru');

export function DropZone({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  busy = false,
  title,
  hint,
  inputLabel,
  compact = false,
}: {
  /** Returns the number of files confirmed by the server. */
  onFiles: (files: File[]) => Promise<number>;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  title: string;
  hint: string;
  inputLabel: string;
  /** Узкая полоса вместо большого блока — когда файлы уже загружены. */
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const counter = useRef(0);
  const pending = useRef(false);
  const [over, setOver] = useState(false);
  const [flying, setFlying] = useState<Flying[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; count: number }>();
  const blocked = disabled || busy || submitting;
  const hovering = over && !blocked;
  useEffect(() => {
    if (!flying.length) return;
    const timer = setTimeout(() => {
      setFlying([]);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [flying]);
  async function take(list: FileList | null) {
    const files = [...(list ?? [])].filter((file) => file.size > 0);
    if (!files.length || blocked || pending.current) return;
    const selected = multiple ? files : files.slice(0, 1);
    pending.current = true;
    setSubmitting(true);
    setReceipt(undefined);
    setFlying(
      selected.slice(0, 6).map((file) => ({
        id: ++counter.current,
        name: file.name,
        image: /\.(jpe?g|png|webp|tiff?)$/i.test(file.name),
      })),
    );
    try {
      const count = await onFiles(selected);
      if (count > 0) setReceipt({ id: counter.current, count });
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  const drag = (event: DragEvent, entering: boolean | null) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    if (entering === true) depth.current++;
    if (entering === false) depth.current = Math.max(0, depth.current - 1);
    setOver(depth.current > 0 && !blocked);
  };
  const loading = busy || submitting;
  const state = hovering
    ? 'hungry'
    : loading || flying.length
      ? 'active'
      : 'idle';
  const plural = receipt ? filePlural.select(receipt.count) : 'other';
  return (
    <div
      onDragEnter={(event) => {
        drag(event, true);
      }}
      onDragOver={(event) => {
        drag(event, null);
      }}
      onDragLeave={(event) => {
        drag(event, false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        void take(event.dataTransfer.files);
      }}
      data-over={hovering || undefined}
      data-disabled={disabled || undefined}
      className={`group/drop glass relative isolate overflow-hidden border transition-[border-color,box-shadow] duration-300 data-[disabled]:*:opacity-60 data-[over]:border-[#ff3b62]/70 data-[over]:shadow-[0_0_0_4px_#db143c22,0_0_60px_-10px_#db143c] ${compact ? 'rounded-2xl border-dashed border-white/15 px-4 py-3.5 sm:px-5' : 'rounded-3xl border-white/10 bg-[radial-gradient(60%_70%_at_50%_55%,#2a0a1299_0%,transparent_70%)] px-6 py-8 sm:px-10 sm:py-10'}`}
    >
      {compact ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="relative -z-10 hidden size-11 shrink-0 sm:block">
            <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2">
              <EventHorizon
                state={state}
                pulseId={receipt?.id ?? 0}
                className="size-24"
              />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              <span className="group-data-[over]/drop:hidden">{title}</span>
              <span className="hidden group-data-[over]/drop:inline">
                Отпустите — Anyko заберёт файлы
              </span>
            </p>
            <p className="text-muted mt-0.5 text-xs leading-5">{hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              role="status"
              className={receipt ? 'text-muted text-xs' : 'sr-only'}
            >
              {receipt &&
                `Принято ${String(receipt.count)} ${plural === 'one' ? 'файл' : plural === 'few' ? 'файла' : 'файлов'}`}
            </span>
            <Button
              size="sm"
              disabled={disabled}
              loading={loading}
              onClick={() => input.current?.click()}
            >
              <Upload size={15} />
              {multiple ? 'Выбрать файлы' : 'Выбрать файл'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <p className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span className="group-data-[over]/drop:hidden">{title}</span>
            <span className="hidden group-data-[over]/drop:inline">
              Отпустите — Anyko заберёт файлы
            </span>
          </p>
          <p className="text-muted mt-2 max-w-xl text-sm leading-6">{hint}</p>
          {/* The emblem is larger than its slot and glows behind the copy. */}
          <div className="relative -z-10 my-2 h-48 w-full sm:h-56">
            <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2">
              <EventHorizon
                state={state}
                pulseId={receipt?.id ?? 0}
                className="size-72 sm:size-[26rem] lg:size-[30rem]"
              />
            </span>
            {flying.map((file, index) => (
              <span
                key={file.id}
                aria-hidden
                className={`animate-absorb absolute top-1/2 left-1/2 -mt-4 -ml-14 flex h-8 w-28 items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900/90 px-2 text-[11px] text-zinc-200 shadow-[0_0_16px_#db143c80] motion-reduce:hidden ${orbits[index] ?? ''}`}
              >
                {file.image ? (
                  <ImageIcon size={13} className="text-rose-300" />
                ) : (
                  <FileText size={13} className="text-rose-300" />
                )}
                <span className="truncate">{file.name}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <Button
              size="lg"
              disabled={disabled}
              loading={loading}
              onClick={() => input.current?.click()}
            >
              <Upload size={17} />
              {multiple ? 'Выбрать файлы' : 'Выбрать файл'}
            </Button>
            <span
              role="status"
              className={receipt ? 'text-ink text-sm' : 'sr-only'}
            >
              {receipt &&
                `Принято ${String(receipt.count)} ${plural === 'one' ? 'файл' : plural === 'few' ? 'файла' : 'файлов'}`}
            </span>
            {!receipt && (
              <span className="text-muted hidden text-xs sm:inline">
                или перетащите их в Anyko
              </span>
            )}
          </div>
        </div>
      )}
      <Input
        ref={input}
        type="file"
        aria-label={inputLabel}
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={blocked}
        onChange={(event) => {
          void take(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
