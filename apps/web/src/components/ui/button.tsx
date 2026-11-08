'use client';
import { Button as Primitive } from '@base-ui/react/button';

import { Spinner } from '@/components/ui/spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary:
    'border-[#ff4d72]/40 bg-[linear-gradient(180deg,#f2194b,#c40c35)] text-white shadow-[inset_0_1px_0_#ffffff38,0_0_0_1px_#db143c40,0_10px_30px_-12px_#db143ccc] hover:shadow-[inset_0_1px_0_#ffffff40,0_0_0_1px_#ff3b6290,0_14px_40px_-10px_#ff2350] data-[disabled]:shadow-none after:pointer-events-none after:absolute after:inset-y-0 after:-left-1/2 after:w-1/3 after:-skew-x-12 after:bg-white/25 after:blur-sm after:opacity-0 after:transition-[left,opacity] after:duration-700 hover:after:left-[130%] hover:after:opacity-100',
  secondary:
    'border-white/10 bg-white/[0.04] text-ink shadow-[inset_0_1px_0_#ffffff0d] backdrop-blur-md hover:border-brand/45 hover:bg-white/[0.07] hover:shadow-[inset_0_1px_0_#ffffff14,0_0_22px_-8px_#db143c] aria-pressed:border-brand/50 aria-pressed:bg-tint',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-white/[0.06] hover:text-ink aria-pressed:text-ink',
  danger:
    'border-red-400/20 bg-red-500/[0.06] text-red-300 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-200',
};
const sizes: Record<Size, string> = {
  xs: 'min-h-7 gap-1 rounded-md px-2 text-xs',
  sm: 'min-h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'min-h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'min-h-12 gap-2.5 rounded-xl px-6 text-[15px]',
  icon: 'size-11 rounded-xl',
  'icon-sm': 'size-9 rounded-lg',
};

const base =
  'group/button focus-visible:outline-brand-hot relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden border font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,transform,opacity] duration-200 select-none focus-visible:outline-2 focus-visible:outline-offset-3 active:scale-[0.97] data-[disabled]:active:scale-100';

/** Button look for links (`<a>`, Next `Link`) that navigate rather than act. */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
}: { variant?: Variant; size?: Size } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: Omit<Primitive.Props, 'className'> & {
  className?: string;
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the content width; the label stays readable. */
  loading?: boolean;
}) {
  return (
    <Primitive
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      focusableWhenDisabled={loading}
      {...props}
      className={`${buttonStyles({ variant, size })} ${loading ? '[&>svg]:hidden' : 'data-[disabled]:opacity-45'} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </Primitive>
  );
}
