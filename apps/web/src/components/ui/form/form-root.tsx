'use client';
import type { AnyFormApi } from '@tanstack/react-form';
import { type ComponentType, type ReactNode, useRef } from 'react';

import { clearServerErrors } from './server-errors';

const controlSelector =
  'input, select, textarea, button, [role="radio"], [tabindex]:not([tabindex="-1"])';

// Фокус идёт на первое поле с ошибкой в порядке документа. Группа радио помечается на role=radiogroup,
// который не принимает фокус, поэтому фокус переводится на её первую радио-кнопку.
function focusFirstInvalid(root: HTMLElement | null) {
  const marked = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!marked) return;
  const target = marked.matches(controlSelector)
    ? marked
    : marked.querySelector<HTMLElement>(controlSelector);
  target?.focus();
}

// Форма с TanStack Form: без нативной проверки браузера (проверяет TanStack), после неуспешной
// отправки переводит фокус на первое поле с ошибкой. Сюда передаётся результат useAppForm.
export function FormRoot({
  form,
  className,
  children,
}: {
  form: AnyFormApi & { AppForm: ComponentType<{ children?: ReactNode }> };
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const AppForm = form.AppForm;
  return (
    <AppForm>
      <form
        ref={ref}
        noValidate
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          clearServerErrors(form);
          void form.handleSubmit().then(() => {
            if (!form.state.isValid) focusFirstInvalid(ref.current);
          });
        }}
      >
        {children}
      </form>
    </AppForm>
  );
}
