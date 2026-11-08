'use client';
import { useEffect, useRef } from 'react';

import {
  paintDeepSky,
  paintTwinkles,
  type TwinklingStar,
} from '@/components/cosmos/deep-sky';

// Twinkling is slow; a low frame rate keeps glass panels cheap to re-blur.
const frameInterval = 1000 / 12;

/** Fixed deep-sky backdrop for the authenticated workspace. */
export function DeepSkyBackdrop() {
  const sky = useRef<HTMLCanvasElement>(null);
  const twinkles = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const base = sky.current,
      overlay = twinkles.current;
    if (!base || !overlay) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stars: TwinklingStar[] = [];
    let width = 0,
      height = 0;
    let frame = 0,
      previous = 0,
      timer = 0;
    const paint = () => {
      const nextWidth = base.clientWidth,
        nextHeight = base.clientHeight;
      // Ignore small height changes such as a mobile address bar collapsing.
      if (nextWidth === width && Math.abs(nextHeight - height) < 120) return;
      width = nextWidth;
      height = nextHeight;
      stars = paintDeepSky(base, width, height);
      base.dataset.ready = 'true';
      paintTwinkles(overlay, width, height, stars, 0);
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - previous < frameInterval) return;
      previous = now;
      paintTwinkles(overlay, width, height, stars, now / 1000);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      if (!reduced.matches) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 160);
    };
    // Paint after the interface so the sky never delays the first frame.
    resize();
    start();
    window.addEventListener('resize', resize);
    reduced.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', start);
    };
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#060608]"
    >
      <canvas
        ref={sky}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100"
      />
      <canvas ref={twinkles} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
