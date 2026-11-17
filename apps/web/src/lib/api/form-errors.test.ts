import { expect, test } from 'bun:test';

import { FormApi } from '@tanstack/react-form';

import { ApiError } from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/api/form-errors';

// Значения серверных ошибок читаются как unknown: тип errorMap у формы без валидаторов узкий.
function read(value: unknown): unknown {
  return value;
}

const texts = {
  codes: {
    TOO_LONG: 'Название слишком длинное.',
    INVALID_WORK_INPUT: 'Проверьте введённые данные.',
  },
  fallback: 'Общая формулировка.',
  technical: 'Техническая формулировка.',
};

function createForm() {
  return new FormApi({ defaultValues: { title: '', baseURL: '' } });
}

test('field error from the response lands on the field with the same name', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INVALID_REQUEST', 400, 'r1', [
      { path: ['title'], code: 'TOO_LONG' },
    ]),
    texts,
  );
  expect(read(form.state.fieldMeta.title?.errorMap.onServer)).toBe(
    'Название слишком длинное.',
  );
  expect(form.state.isFieldsValid).toBe(false);
  expect(read(form.state.errorMap.onServer)).toBeUndefined();
});

test('field without its own code text uses the text of the response code', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INVALID_WORK_INPUT', 400, 'r1', [
      { path: ['baseURL'], code: 'UNKNOWN_FIELD_CODE' },
    ]),
    texts,
  );
  expect(read(form.state.fieldMeta.baseURL?.errorMap.onServer)).toBe(
    'Проверьте введённые данные.',
  );
});

test('field that the form does not have goes to the form-level error', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INVALID_REQUEST', 400, 'r1', [
      { path: ['title'], code: 'TOO_LONG' },
      { path: ['ghost'], code: 'TOO_LONG' },
    ]),
    texts,
  );
  expect(Object.keys(form.state.fieldMeta)).not.toContain('ghost');
  expect(read(form.state.fieldMeta.title?.errorMap.onServer)).toBe(
    'Название слишком длинное.',
  );
  expect(read(form.state.errorMap.onServer)).toBe('Название слишком длинное.');
});

test('the first error of a field wins when the response repeats the path', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INVALID_REQUEST', 400, 'r1', [
      { path: ['title'], code: 'TOO_LONG' },
      { path: ['title'], code: 'INVALID_WORK_INPUT' },
    ]),
    texts,
  );
  expect(read(form.state.fieldMeta.title?.errorMap.onServer)).toBe(
    'Название слишком длинное.',
  );
});

test('error without fields becomes the form-level error with the common text', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INTERNAL_ERROR', 500, 'r1', undefined),
    texts,
  );
  expect(read(form.state.errorMap.onServer)).toBe('Техническая формулировка.');
  expect(form.state.isFieldsValid).toBe(true);
});

test('empty fields list is not silently dropped', () => {
  const form = createForm();
  applyServerErrors(form, new ApiError('TOO_LONG', 400, 'r1', []), texts);
  expect(read(form.state.errorMap.onServer)).toBe('Название слишком длинное.');
});

test('non-API failure never shows its raw message', () => {
  const form = createForm();
  applyServerErrors(form, new Error('private provider body'), texts);
  expect(read(form.state.errorMap.onServer)).toBe('Общая формулировка.');
});

test('a new response replaces the server errors of the previous one', () => {
  const form = createForm();
  applyServerErrors(
    form,
    new ApiError('INVALID_REQUEST', 400, 'r1', [
      { path: ['title'], code: 'TOO_LONG' },
    ]),
    texts,
  );
  applyServerErrors(form, new Error('network'), texts);
  expect(read(form.state.fieldMeta.title?.errorMap.onServer)).toBeUndefined();
  expect(read(form.state.errorMap.onServer)).toBe('Общая формулировка.');
});
