'use client';
import { Field } from '@base-ui/react/field';
import type { ReactNode } from 'react';

export function FormField({
  label,
  children,
  className = '',
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field.Root className={`grid gap-2 ${className}`}>
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      {children}
      <Field.Error className="text-xs text-red-700 dark:text-red-300" />
    </Field.Root>
  );
}
