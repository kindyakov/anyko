'use client';
import { createFormHook } from '@tanstack/react-form';

import { fieldContext, formContext } from './contexts';
import { RadioGroupField, SubmitButton, TextField } from './fields';

// Единая связка TanStack Form с полями Base UI. Features используют только useAppForm, не библиотеку напрямую.
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, RadioGroupField },
  formComponents: { SubmitButton },
});
