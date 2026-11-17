'use client';
import { Field } from '@base-ui/react/field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { type AnyFieldApi, useSelector } from '@tanstack/react-form';
import { type ComponentProps, type ReactNode, type Ref, useId } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useFieldContext, useFormContext } from './contexts';
import { clearServerErrors } from './server-errors';

// Клиентская схема отдаёт issue с полем message, серверная ошибка — строку.
function messageOf(error: unknown): string | undefined {
  const text =
    typeof error === 'string'
      ? error
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : '';
  return text === '' ? undefined : text;
}

// Ошибка видна после потери фокуса полем или после отправки формы. TanStack помечает поле касанием
// уже на первом символе, поэтому для показа используется blur, а не isTouched.
function useVisibleError(field: AnyFieldApi): string | undefined {
  const submitted = useSelector(
    field.form.store,
    (state) => state.submissionAttempts > 0,
  );
  const meta = field.state.meta;
  if (!meta.isBlurred && !submitted) return undefined;
  for (const error of meta.errors) {
    const message = messageOf(error);
    if (message !== undefined) return message;
  }
  return undefined;
}

type InputProps = ComponentProps<typeof Input>;

export function TextField({
  label,
  description,
  trailing,
  ref,
  disabled = false,
  className = '',
  ...inputProps
}: Omit<
  InputProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
> & {
  label: ReactNode;
  description?: ReactNode;
  /** Элемент внутри поля справа, например переключатель видимости пароля. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}) {
  const field = useFieldContext<string>();
  const submitting = useSelector(
    field.form.store,
    (state) => state.isSubmitting,
  );
  const error = useVisibleError(field);
  const errorId = useId();
  const input = (
    <Input
      {...inputProps}
      ref={ref}
      name={field.name}
      value={field.state.value}
      disabled={disabled || submitting}
      aria-invalid={error === undefined ? undefined : true}
      aria-describedby={error === undefined ? undefined : errorId}
      className={className}
      onBlur={field.handleBlur}
      onChange={(event) => {
        clearServerErrors(field.form);
        field.handleChange(event.target.value);
      }}
    />
  );
  return (
    <Field.Root invalid={error !== undefined} className="grid gap-2">
      <Field.Label className="text-[13px] font-medium text-zinc-200">
        {label}
      </Field.Label>
      {trailing ? (
        <div className="relative">
          {input}
          {trailing}
        </div>
      ) : (
        input
      )}
      {description && (
        <Field.Description className="text-muted text-xs leading-5">
          {description}
        </Field.Description>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      )}
    </Field.Root>
  );
}

type RadioOption = { value: string; children: ReactNode };

// Группа вариантов: каждый вариант — карточка с радио-кнопкой; содержимое варианта задаёт feature.
export function RadioGroupField({
  label,
  options,
  disabled = false,
}: {
  label: ReactNode;
  options: readonly RadioOption[];
  disabled?: boolean;
}) {
  const field = useFieldContext<string>();
  const submitting = useSelector(
    field.form.store,
    (state) => state.isSubmitting,
  );
  const error = useVisibleError(field);
  const errorId = useId();
  const labelId = useId();
  return (
    <Field.Root invalid={error !== undefined} className="grid gap-2.5">
      <span id={labelId} className="text-[13px] font-medium text-zinc-200">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        name={field.name}
        value={field.state.value}
        disabled={disabled || submitting}
        className="grid gap-2.5"
        onBlur={field.handleBlur}
        onValueChange={(value) => {
          clearServerErrors(field.form);
          field.handleChange(value);
        }}
      >
        {options.map((option, index) => {
          const radioId = `${labelId}-${String(index)}`;
          return (
            <label
              key={option.value}
              htmlFor={radioId}
              className="group has-[[data-checked]]:border-brand/60 has-[[data-checked]]:bg-brand/[0.07] flex cursor-pointer items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 has-[[data-checked]]:shadow-[0_0_30px_-12px_#db143c]"
            >
              <Radio.Root
                id={radioId}
                value={option.value}
                className="data-[checked]:border-brand-hot focus-visible:outline-brand-hot mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Radio.Indicator className="bg-brand-hot size-2.5 rounded-full shadow-[0_0_8px_#ff3b62] data-[unchecked]:hidden" />
              </Radio.Root>
              <span className="min-w-0">{option.children}</span>
            </label>
          );
        })}
      </RadioGroup>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      )}
    </Field.Root>
  );
}

// Кнопка отправки блокируется во время отправки и после неуспешной попытки, пока есть ошибки полей.
// До первой попытки она доступна: иначе пустое поле гасит кнопку, и ошибка не появляется по клику.
// Общая ошибка формы (например, сетевой сбой) не блокирует повтор: canSubmit учитывает её и не дал бы повторить отправку.
export function SubmitButton({
  children,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, 'type' | 'loading' | 'disabled'> & {
  children: ReactNode;
}) {
  const form = useFormContext();
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const blocked = useSelector(
    form.store,
    (state) => state.submissionAttempts > 0 && !state.isFieldsValid,
  );
  return (
    <Button
      {...buttonProps}
      type="submit"
      loading={submitting}
      disabled={blocked}
    >
      {children}
    </Button>
  );
}
