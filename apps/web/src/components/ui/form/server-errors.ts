import type {
  AnyFieldLikeMetaBase,
  AnyFieldMeta,
  AnyFormApi,
} from '@tanstack/react-form';

// Форма, которой нужны только состояние и методы серверных ошибок: тесты и features передают свой экземпляр без приведения типов.
export type ServerErrorTarget = Pick<
  AnyFormApi,
  'state' | 'setErrorMap' | 'setFieldMeta'
>;

// Начальная meta поля, которое ещё не зарегистрировано в форме (как defaultFieldMeta в TanStack).
const untouchedFieldMeta: AnyFieldMeta = {
  isValidating: false,
  isTouched: false,
  isBlurred: false,
  isDirty: false,
  isPristine: true,
  isValid: true,
  isDefaultValue: true,
  errors: [],
  errorMap: {},
  errorSourceMap: {},
  _arrayVersion: 0,
  _pendingValidationsCount: 0,
};

// Серверная ошибка хранится под ключом `onServer`: у поля — в его meta, общая — в errorMap формы.
// Ключ входит в validity формы, поэтому его снимают перед новой отправкой и при правке поля;
// иначе кнопка отправки останется заблокированной после уже исправленной ошибки.
export function clearServerErrors(form: ServerErrorTarget): void {
  if (form.state.errorMap.onServer !== undefined)
    form.setErrorMap({ onServer: undefined });
  for (const [name, meta] of Object.entries(form.state.fieldMeta)) {
    if (meta?.errorMap.onServer === undefined) continue;
    form.setFieldMeta(name, (prev) => ({
      ...prev,
      errorMap: { ...prev.errorMap, onServer: undefined },
    }));
  }
}

// Заменяет все серверные ошибки формы набором новых. Поля передаются только существующими в форме:
// проверку выполняет вызывающий (см. applyServerErrors в lib/api).
export function setServerErrors(
  form: ServerErrorTarget,
  errors: { fields?: Readonly<Record<string, string>>; form?: string },
): void {
  clearServerErrors(form);
  for (const [name, message] of Object.entries(errors.fields ?? {})) {
    form.setFieldMeta(name, (prev: AnyFieldLikeMetaBase | undefined) => {
      const meta = prev ?? untouchedFieldMeta;
      return { ...meta, errorMap: { ...meta.errorMap, onServer: message } };
    });
  }
  if (errors.form !== undefined) form.setErrorMap({ onServer: errors.form });
}
