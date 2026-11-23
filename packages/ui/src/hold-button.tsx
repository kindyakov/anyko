'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from './button';

const tick = 50;
const holdMs = 3000;

/**
 * Кнопка, которая срабатывает после трёх секунд непрерывного удержания: указателем
 * или клавишами Space/Enter. Отпускание, уход указателя за пределы кнопки,
 * потеря фокуса или окна сбрасывают прогресс. `onComplete` вызывается один раз
 * за время жизни компонента; новый экземпляр — через `key`.
 */
export function HoldButton({
  children,
  progressLabel,
  disabled,
  icon,
  className = '',
  onComplete,
}: {
  children: ReactNode;
  /** Доступное название индикатора прогресса. */
  progressLabel: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  onComplete: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const done = useRef(false);
  const holding = elapsed > 0;

  function stop() {
    window.clearInterval(timer.current);
    timer.current = undefined;
    setElapsed(0);
  }
  function start() {
    if (disabled || done.current || timer.current !== undefined) return;
    const started = performance.now();
    setElapsed(1);
    timer.current = window.setInterval(() => {
      const duration = performance.now() - started;
      if (duration < holdMs) {
        setElapsed(duration);
        return;
      }
      done.current = true;
      stop();
      onComplete();
    }, tick);
  }

  useEffect(() => {
    const reset = () => {
      window.clearInterval(timer.current);
      timer.current = undefined;
      setElapsed(0);
    };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      reset();
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={holdMs}
        aria-valuenow={Math.round(elapsed)}
        className="sr-only"
      />
      <Button
        variant="danger"
        disabled={disabled}
        className={`w-full touch-none ${holding ? 'border-red-400/60 text-red-100' : ''}`}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          start();
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            stop();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          if (!event.repeat) start();
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') stop();
        }}
        onBlur={stop}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 origin-left bg-linear-to-r from-red-500/20 to-red-500/45 transition-transform ease-linear ${holding ? 'scale-x-100 duration-3000' : 'scale-x-0 duration-200'}`}
        />
        {icon}
        {children}
      </Button>
    </div>
  );
}
