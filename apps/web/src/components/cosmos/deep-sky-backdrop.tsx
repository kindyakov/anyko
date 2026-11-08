'use client';
import { useEffect, useRef } from 'react';

import {
  type DeepSky,
  launchMeteor,
  type Meteor,
  paintDeepSky,
  paintNebula,
  paintSkyMotion,
} from '@/components/cosmos/deep-sky';

// The sky moves slowly, so a low frame rate keeps glass panels cheap to
// re-blur; a meteor gets full frames only for the second it flies.
const calmInterval = 1000 / 20;
const meteorInterval = 1000 / 60;
// Seconds for the nebula to churn into its second state and back.
const flowPeriod = 26;

/** Fixed, slowly living deep-sky backdrop for the authenticated workspace. */
export function DeepSkyBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const nebula = useRef<HTMLCanvasElement>(null);
  const flow = useRef<HTMLCanvasElement>(null);
  const stars = useRef<HTMLCanvasElement>(null);
  const motion = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const frameElement = root.current,
      gas = nebula.current,
      churn = flow.current,
      still = stars.current,
      living = motion.current;
    if (!frameElement || !gas || !churn || !still || !living) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sky: DeepSky | undefined;
    let meteor: Meteor | undefined;
    let width = 0,
      height = 0;
    let frame = 0,
      previous = 0,
      timer = 0,
      churnTimer = 0,
      churnSince = Infinity,
      nextMeteor = 0;
    const render = (seconds: number) => {
      if (!sky) return;
      // The second gas state fades in over a few seconds once it is ready.
      const ready = Math.min(1, Math.max(0, (seconds - churnSince) / 4));
      const breath = 0.5 - 0.5 * Math.cos((seconds / flowPeriod) * Math.PI * 2);
      churn.style.opacity = String(breath * ready);
      gas.style.transform = `translate(${String(Math.sin(seconds / 37) * 12)}px, ${String(Math.cos(seconds / 53) * 8)}px)`;
      churn.style.transform = `translate(${String(-Math.sin(seconds / 43) * 12)}px, ${String(-Math.cos(seconds / 47) * 8)}px)`;
      paintSkyMotion(living, sky, seconds, meteor);
    };
    const prepareChurn = () => {
      window.clearTimeout(churnTimer);
      if (reduced.matches || !sky || Number.isFinite(churnSince)) return;
      // Computed after the first frame so it never delays the backdrop.
      churnTimer = window.setTimeout(() => {
        if (!sky) return;
        paintNebula(churn, sky, 1);
        churnSince = performance.now() / 1000;
      }, 400);
    };
    const paint = () => {
      const nextWidth = still.clientWidth,
        nextHeight = still.clientHeight;
      // Ignore small height changes such as a mobile address bar collapsing.
      if (nextWidth === width && Math.abs(nextHeight - height) < 120) return;
      width = nextWidth;
      height = nextHeight;
      sky = paintDeepSky(still, width, height);
      paintNebula(gas, sky, 0);
      churnSince = Infinity;
      frameElement.dataset.ready = 'true';
      render(reduced.matches ? 0 : performance.now() / 1000);
      prepareChurn();
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const seconds = now / 1000;
      if (meteor && seconds - meteor.born > meteor.life) meteor = undefined;
      if (!meteor && sky && seconds >= nextMeteor) {
        meteor = launchMeteor(width, height, seconds);
        nextMeteor = seconds + 8 + Math.random() * 12;
      }
      if (now - previous < (meteor ? meteorInterval : calmInterval) - 2) return;
      previous = now;
      render(seconds);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      if (reduced.matches) {
        churn.style.opacity = '0';
        render(0);
        return;
      }
      nextMeteor = performance.now() / 1000 + 3 + Math.random() * 3;
      prepareChurn();
      frame = requestAnimationFrame(tick);
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
      window.clearTimeout(churnTimer);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', start);
    };
  }, []);
  return (
    <div
      ref={root}
      aria-hidden
      className="group/sky pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#060608]"
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-1000 group-data-[ready=true]/sky:opacity-100">
        {/* Gas overhangs the screen by the renderer's 24px margin so it can drift. */}
        <canvas
          ref={nebula}
          className="absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)]"
        />
        <canvas
          ref={flow}
          className="absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] opacity-0"
        />
        <canvas
          ref={stars}
          className="absolute inset-0 h-full w-full mix-blend-plus-lighter"
        />
        <canvas
          ref={motion}
          className="absolute inset-0 h-full w-full mix-blend-plus-lighter"
        />
      </div>
    </div>
  );
}
