'use client';
import { useEffect, useRef } from 'react';

import { startBlackHole } from '@/components/cosmos/black-hole-renderer';

export function CosmicBackground({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stop: () => void = () => undefined;
    const update = () => {
      stop();
      stop = startBlackHole(canvas, !paused && !reduced.matches);
    };
    update();
    reduced.addEventListener('change', update);
    return () => {
      stop();
      reduced.removeEventListener('change', update);
    };
  }, [paused]);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden bg-black"
    >
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100 motion-reduce:transition-none"
      />
      <div className="absolute inset-0 bg-black/25 lg:bg-linear-to-r lg:from-transparent lg:via-transparent lg:to-black/40" />
    </div>
  );
}
