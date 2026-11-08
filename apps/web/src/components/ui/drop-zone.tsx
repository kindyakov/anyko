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
      className="group/drop relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_140%_at_50%_0%,#2a0a12_0%,#0d0d10_45%,#08080a_100%)] p-6 transition-[border-color,box-shadow] duration-300 data-[disabled]:opacity-60 data-[over]:border-[#ff3b62]/70 data-[over]:shadow-[0_0_0_4px_#db143c22,0_0_60px_-10px_#db143c] sm:p-8"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1px_1px_at_12%_22%,#fff9,transparent),radial-gradient(1px_1px_at_78%_18%,#fff7,transparent),radial-gradient(1px_1px_at_64%_74%,#fff6,transparent),radial-gradient(1.5px_1.5px_at_30%_80%,#ffd6de,transparent),radial-gradient(1px_1px_at_90%_60%,#fff8,transparent),radial-gradient(1px_1px_at_45%_12%,#fff5,transparent)]"
      />
      <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        <div className="relative grid size-44 shrink-0 place-items-center sm:size-52">
          <EventHorizon state={state} className="size-36 sm:size-44" />
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
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span className="group-data-[over]/drop:hidden">{title}</span>
            <span className="hidden group-data-[over]/drop:inline">
              Отпустите — Anyko заберёт файлы
            </span>
          </p>
          <p className="text-muted mt-2 max-w-xl text-sm leading-6">{hint}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
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
              или перетащите их сюда
            </span>
          </div>
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
