'use client';
import { Checkbox as Primitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

const box =
  'text-ink focus-visible:outline-brand-hot data-checked:border-brand/70 data-checked:bg-brand/25 data-indeterminate:border-brand/70 data-indeterminate:bg-brand/25 grid size-5 shrink-0 place-items-center rounded-md border border-white/20 bg-white/5 transition-[background-color,border-color] duration-150 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-3 data-disabled:opacity-50';

/**
 * Флажок Base UI. С `children` подпись становится кликабельной меткой;
 * без неё нужно доступное название через `aria-label`.
 */
export function Checkbox({
  id,
  checked,
  indeterminate = false,
  disabled,
  onCheckedChange,
  children,
  'aria-label': ariaLabel,
  className = '',
}: {
  id?: string | undefined;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
  'aria-label'?: string;
  className?: string;
}) {
  const root = (
    <Primitive.Root
      id={id}
      aria-label={ariaLabel}
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={`${box} ${children ? 'mt-0.5' : className}`}
    >
      <Primitive.Indicator>
        {indeterminate ? (
          <Minus size={14} strokeWidth={2.5} />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
      </Primitive.Indicator>
    </Primitive.Root>
  );
  if (!children) return root;
  return (
    <label
      className={`flex items-start gap-3 text-sm leading-6 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      {root}
      <span className="min-w-0">{children}</span>
    </label>
  );
}
