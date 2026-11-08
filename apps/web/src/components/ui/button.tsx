'use client';
import { Button as Primitive } from '@base-ui/react/button';
export function Button({
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: Omit<Primitive.Props, 'className'> & {
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Primitive
      type={type}
      {...props}
      className={`focus-visible:outline-brand inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'border-brand bg-brand hover:bg-brand/90 text-white' : 'border-line bg-surface text-ink hover:bg-canvas aria-pressed:bg-tint aria-selected:bg-tint'} ${className}`}
    />
  );
}
