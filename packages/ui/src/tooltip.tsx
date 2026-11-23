'use client';
import { Tooltip as Primitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

/**
 * Подсказка Base UI для элементов без видимого текста, например кнопок-иконок.
 * `children` — один интерактивный элемент (обычно `Button`): подсказка подключается
 * к нему через `render`, поэтому фокус с клавиатуры тоже её открывает.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger render={children} />
      <Primitive.Portal>
        <Primitive.Positioner side={side} sideOffset={8} className="z-[70]">
          <Primitive.Popup className="text-ink rounded-lg border border-white/10 bg-[#17171b]/95 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-[0_12px_32px_-12px_#000] backdrop-blur-md transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {content}
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
