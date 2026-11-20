import { type ServerErrorTarget, setServerErrors } from '@anyko/ui/form';

import {
  ApiError,
  type ApiErrorTexts,
  describeApiError,
} from '@/lib/api/errors';

const fieldTexts: Record<string, string> = {
  required: 'Заполните это поле.',
  invalid_type: 'Проверьте тип значения.',
  invalid_format: 'Проверьте формат значения.',
  too_short: 'Значение слишком короткое.',
  too_long: 'Значение слишком длинное.',
  too_small: 'Значение слишком маленькое.',
  too_big: 'Значение слишком большое.',
  invalid_value: 'Проверьте значение поля.',
};

// Раскладывает ошибку команды по форме. Поля `fields` ответа попадают к полям с тем же именем;
// поле, которого нет в форме, и любая ошибка без разбора полей становятся общей ошибкой формы.
// Тексты берутся из `codes` feature: по коду поля, а если его нет — по коду ответа.
export function applyServerErrors(
  form: ServerErrorTarget,
  error: unknown,
  texts: ApiErrorTexts = {},
): void {
  if (!(error instanceof ApiError) || !error.fields?.length) {
    setServerErrors(form, { form: describeApiError(error, texts) });
    return;
  }
  const fields: Record<string, string> = {};
  const outside: string[] = [];
  for (const { path, code } of error.fields) {
    const message =
      texts.codes?.[code] ?? fieldTexts[code] ?? describeApiError(error, texts);
    const field =
      path.length === 1 && typeof path[0] === 'string' ? path[0] : undefined;
    if (field !== undefined && isFormField(form, field)) {
      fields[field] ??= message;
    } else if (!outside.includes(message)) {
      outside.push(message);
    }
  }
  setServerErrors(
    form,
    outside.length > 0 ? { fields, form: outside.join(' ') } : { fields },
  );
}

// Поле существует, если оно есть в значениях формы (значения по умолчанию задают все поля).
function isFormField(form: ServerErrorTarget, path: string): boolean {
  const values: unknown = form.state.values;
  return (
    typeof values === 'object' && values !== null && Object.hasOwn(values, path)
  );
}
