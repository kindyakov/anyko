// Вид ошибки описывает, что клиент может сделать. HTTP переводит вид в статус
// одной таблицей; код остаётся стабильным идентификатором для web и журнала.
export type ErrorKind =
  | 'invalid'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'precondition'
  | 'unavailable';

export class AppError<C extends string = string> extends Error {
  readonly code: C;
  readonly kind: ErrorKind;

  constructor(code: C, kind: ErrorKind, options?: ErrorOptions) {
    super(code, options);
    this.code = code;
    this.kind = kind;
  }
}

// instanceof сужает generic-класс до AppError<any>; предикат даёт код типа string.
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

// Модуль объявляет свои коды и их виды одним объектом. Вид известен типу,
// поэтому опечатка в коде или виде не компилируется.
export function defineErrors<const M extends Record<string, ErrorKind>>(
  map: M,
) {
  type Code = keyof M & string;
  class Failure extends AppError<Code> {
    constructor(code: Code, options?: ErrorOptions) {
      const kind = map[code];
      // Коды проверяет тип; проверка здесь защищает вызовы без типов (JS, данные из журнала).
      if (kind === undefined) throw new Error(`Undeclared error code: ${code}`);
      super(code, kind, options);
    }
  }
  return { Failure, codes: Object.keys(map) as Code[] };
}
