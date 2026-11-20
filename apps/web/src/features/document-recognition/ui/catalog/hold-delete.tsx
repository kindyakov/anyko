import { useEffect, useRef, useState } from 'react';

import { Button } from '@anyko/ui';

const holdMs = 3000;

export function HoldDelete({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const confirmed = useRef(false);
  function stop() {
    window.clearInterval(timer.current);
    timer.current = undefined;
    setElapsed(0);
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
      window.clearInterval(timer.current);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, []);
  function confirm() {
    if (confirmed.current) return;
    confirmed.current = true;
    stop();
    onConfirm();
  }
  return (
    <div className="grid w-full gap-2">
      <Button
        variant="danger"
        onPointerDown={(event) => {
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            timer.current !== undefined
          )
            return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const start = performance.now();
          timer.current = window.setInterval(() => {
            const duration = performance.now() - start;
            if (duration >= holdMs) confirm();
            else setElapsed(duration);
          }, 30);
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
        onBlur={stop}
      >
        Удерживайте 3 секунды
      </Button>
      <progress
        className="w-full accent-red-500"
        max={holdMs}
        value={elapsed}
        aria-label="Прогресс подтверждения удаления"
      />
      <label className="text-muted flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked);
          }}
        />
        Подтверждаю удаление из перечисленных работ
      </label>
      <Button variant="danger" disabled={!accepted} onClick={confirm}>
        {label}
      </Button>
    </div>
  );
}
