'use client';
import { useEffect, useRef } from 'react';

import { paintBlackHole } from '@/components/cosmos/black-hole-renderer';

type HorizonState = 'idle' | 'active' | 'hungry' | 'calm';

// Disk speed and glow per state; the emblem eases between them.
const moods: Record<HorizonState, { speed: number; glow: number }> = {
  calm: { speed: 0.35, glow: 0.7 },
  idle: { speed: 1, glow: 1 },
  active: { speed: 2.4, glow: 1.25 },
  hungry: { speed: 4.5, glow: 1.8 },
};

/**
 * The sign-in black hole as an emblem. The box is the layout size; the canvas
 * overflows it on every side so the disk and halo are never cut by the box.
 */
export function EventHorizon({
  state = 'idle',
  className = 'size-40',
}: {
  state?: HorizonState;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mood = useRef(moods[state]);
  useEffect(() => {
    mood.current = moods[state];
  }, [state]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      previous = 0,
      time = 0,
      visible = true;
    const current = { ...mood.current };
    function paint() {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // The disk spans ~1.2 box widths, the shadow about a third of the box.
      const r = Math.min(w, h) * 0.11;
      paintBlackHole(ctx, {
        x: w / 2,
        y: h / 2,
        r,
        time,
        tilt: 0,
        ship: r > 34 ? Math.min(1, r / 70) : 0,
        quality: Math.min(0.8, Math.max(0.3, r / 90)),
        glow: current.glow,
      });
      canvas.dataset.ready = 'true';
    }
    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (previous && now - previous < 32) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      current.speed += (mood.current.speed - current.speed) * 0.08;
      current.glow += (mood.current.glow - current.glow) * 0.08;
      time += delta * current.speed;
      paint();
    }
    function schedule() {
      cancelAnimationFrame(frame);
      previous = 0;
      paint();
      if (visible && !document.hidden && !reduced.matches)
        frame = requestAnimationFrame(tick);
    }
    // Off-screen emblems stop drawing entirely.
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      schedule();
    });
    const resize = new ResizeObserver(paint);
    seen.observe(canvas);
    resize.observe(canvas);
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      reduced.removeEventListener('change', schedule);
    };
  }, []);
  return (
    <span
      aria-hidden
      data-state={state}
      className={`pointer-events-none relative inline-block shrink-0 transition-transform duration-700 ease-out data-[state=hungry]:scale-110 ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100"
      />
    </span>
  );
}
