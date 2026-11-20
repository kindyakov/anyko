'use client';
import type { AnyFormApi } from '@tanstack/react-form';
import { useSelector } from '@tanstack/react-form';

import { Notice } from '../status';

// Общая ошибка формы из серверного ключа `onServer`. Выводится там, где нужна разметкой страницы.
export function FormErrorNotice({ form }: { form: AnyFormApi }) {
  const message: unknown = useSelector(
    form.store,
    (state): unknown => state.errorMap.onServer,
  );
  if (typeof message !== 'string' || message === '') return null;
  return (
    <Notice tone="danger" role="alert">
      {message}
    </Notice>
  );
}
