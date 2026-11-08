'use client';
import { Field } from '@base-ui/react/field';
import type { ReactNode } from 'react';

export function FormField({
  label,
  description,
  children,
  className = '',
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field.Root className={`grid gap-2 ${className}`}>
      <Field.Label className="text-[13px] font-medium text-zinc-200">
        {label}
      </Field.Label>
      {children}
      {description && (
        <Field.Description className="text-muted text-xs leading-5">
          {description}
        </Field.Description>
      )}
      <Field.Error className="text-xs text-red-300" />
    </Field.Root>
  );
}
