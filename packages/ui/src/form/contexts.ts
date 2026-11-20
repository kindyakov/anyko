import { createFormHookContexts } from '@tanstack/react-form';

// Контексты отделены от компонентов полей: createFormHook принимает компоненты, а сами компоненты читают контекст.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
