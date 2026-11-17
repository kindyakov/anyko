import type { FieldRow, FieldValue } from '@anyko/contracts/catalog';

// Значения сведений по ключу. Отсутствующий ключ (undefined) и пустое значение (null) — разные значения,
// как в contracts: поле без значения и поле, очищенное пользователем, не путаются.
export type FactValues = Readonly<Record<string, FieldValue | undefined>>;

// Структурное сравнение значения поля: строки — по содержимому, списки строк — по порядку и содержимому.
export function sameFieldValue(
  a: FieldValue | undefined,
  b: FieldValue | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null)
    return false;
  if (typeof a === 'string' || typeof b === 'string') return false;
  return (
    a.length === b.length &&
    a.every((row, index) => {
      const other = b[index];
      return other !== undefined && sameRow(row, other);
    })
  );
}

// Порядок колонок в строке не важен, набор колонок важен: колонка без значения не равна null.
function sameRow(a: FieldRow, b: FieldRow): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
  );
}

// Сравнение всех ключей обеих сторон; ключ, которого нет у одной стороны, сравнивается как undefined.
export function sameFieldValues(a: FactValues, b: FactValues): boolean {
  return allKeys(a, b).every((key) => sameFieldValue(a[key], b[key]));
}

export function allKeys(...sides: FactValues[]): string[] {
  return [...new Set(sides.flatMap((side) => Object.keys(side)))];
}
