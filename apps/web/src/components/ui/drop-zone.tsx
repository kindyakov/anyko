'use client';
import { Input } from '@base-ui/react/input';
import { FileText, ImageIcon, Upload } from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button } from '@/components/ui/button';

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

export function DropZone({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  busy = false,
  title,
  hint,
  inputLabel,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  title: string;
  hint: string;
  inputLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const counter = useRef(0);
  const [over, setOver] = useState(false);
  const [flying, setFlying] = useState<Flying[]>([]);
  useEffect(() => {
    if (!flying.length) return;
    const timer = setTimeout(() => {
      setFlying([]);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [flying]);
  function take(list: FileList | null) {
    const files = [...(list ?? [])].filter((file) => file.size > 0);
    if (!files.length || disabled) return;
    const accepted = multiple ? files : files.slice(0, 1);
    setFlying(
      accepted.slice(0, 6).map((file) => ({
        id: ++counter.current,
        name: file.name,
        image: /\.(jpe?g|png|webp|tiff?)$/i.test(file.name),
      })),
    );
    onFiles(accepted);
  }
  const drag = (event: DragEvent, entering: boolean | null) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    if (entering === true) depth.current++;
    if (entering === false) depth.current = Math.max(0, depth.current - 1);
    setOver(depth.current > 0 && !disabled);
  };
  const state = over ? 'hungry' : busy || flying.length ? 'active' : 'idle';
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
        take(event.dataTransfer.files);
      }}
      data-over={over || undefined}
      data-disabled={disabled || undefined}
      className="group/drop glass relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(60%_70%_at_50%_55%,#2a0a1299_0%,transparent_70%)] px-6 py-8 transition-[border-color,box-shadow] duration-300 data-[disabled]:*:opacity-60 data-[over]:border-[#ff3b62]/70 data-[over]:shadow-[0_0_0_4px_#db143c22,0_0_60px_-10px_#db143c] sm:px-10 sm:py-10"
    >
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
              className="size-72 sm:size-[26rem] lg:size-[30rem]"
            />
          </span>
          {flying.map((file, index) => (
            <span
              key={file.id}
              aria-hidden
              className={`animate-absorb absolute top-1/2 left-1/2 -mt-4 -ml-14 flex h-8 w-28 items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900/90 px-2 text-[11px] text-zinc-200 shadow-[0_0_16px_#db143c80] ${orbits[index] ?? ''}`}
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
            loading={busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={17} />
            {multiple ? 'Выбрать файлы' : 'Выбрать файл'}
          </Button>
          <span className="text-muted hidden text-xs sm:inline">
            или перетащите их в Anyko
          </span>
        </div>
      </div>
      <Input
        ref={input}
        type="file"
        aria-label={inputLabel}
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          take(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
