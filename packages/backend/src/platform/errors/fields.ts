// Ошибки полей тела запроса: путь из строковых и числовых сегментов и стабильный код.
// Тексты задаёт web; неизвестный вид проверки становится invalid_value.
export type FieldErrorCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_format'
  | 'too_short'
  | 'too_long'
  | 'too_small'
  | 'too_big'
  | 'invalid_value';

export interface FieldError {
  path: (string | number)[];
  code: FieldErrorCode;
}

// Совместимо с Standard Schema и с issues Zod: сегмент пути — ключ или { key }.
export interface FieldIssue {
  readonly path?: readonly unknown[] | undefined;
}

function segments(path: readonly unknown[] | undefined): (string | number)[] {
  return (path ?? []).flatMap((part) => {
    const key: unknown =
      typeof part === 'object' && part !== null
        ? Reflect.get(part, 'key')
        : part;
    return typeof key === 'string' || typeof key === 'number' ? [key] : [];
  });
}

function valueAt(root: unknown, path: (string | number)[]): unknown {
  let value = root;
  for (const key of path)
    value =
      typeof value === 'object' && value !== null
        ? Reflect.get(value, key)
        : undefined;
  return value;
}

function codeOf(issue: FieldIssue, value: unknown): FieldErrorCode {
  const code: unknown = Reflect.get(issue, 'code');
  const origin: unknown = Reflect.get(issue, 'origin');
  if (code === 'invalid_type')
    return value === undefined || value === null ? 'required' : 'invalid_type';
  if (code === 'invalid_format') return 'invalid_format';
  if (code === 'too_small')
    return origin === 'number' ? 'too_small' : 'too_short';
  if (code === 'too_big') return origin === 'number' ? 'too_big' : 'too_long';
  return 'invalid_value';
}

// root — проверенное значение; prefix — путь этого значения внутри тела запроса.
export function fieldErrors(
  issues: readonly FieldIssue[],
  root: unknown,
  prefix: (string | number)[] = [],
): FieldError[] {
  return issues.map((issue) => {
    const path = segments(issue.path);
    return {
      path: [...prefix, ...path],
      code: codeOf(issue, valueAt(root, path)),
    };
  });
}
