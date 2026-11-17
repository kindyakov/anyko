import type { FieldDefinition, FieldValues } from '@anyko/contracts/catalog';

// Test-only catalogue supplied by the server fixture.
export const fieldDefinitions: FieldDefinition[] = [
  {
    key: 'personName',
    label: 'ФИО полностью',
    multiline: false,
    kind: 'text',
    limits: { maxLength: 12000 },
    columns: [],
  },
  {
    key: 'observations',
    label: 'Дополнительные сведения',
    multiline: true,
    kind: 'text',
    limits: { maxLength: 12000 },
    columns: [],
  },
  {
    key: 'lastName',
    label: 'Фамилия',
    multiline: false,
    kind: 'text',
    limits: { maxLength: 12000 },
    columns: [],
  },
  {
    key: 'debts',
    label: 'Кредиторы: личные обязательства',
    multiline: false,
    kind: 'rows',
    limits: { maxRows: 100 },
    columns: [{ key: 'name', label: 'Кредитор / должник', maxLength: 4000 }],
  },
  {
    key: 'businessDebts',
    label: 'Кредиторы: предпринимательские обязательства',
    multiline: false,
    kind: 'rows',
    limits: { maxRows: 100 },
    columns: [{ key: 'name', label: 'Кредитор / должник', maxLength: 4000 }],
  },
];
export function emptyFieldValues(): FieldValues {
  return Object.fromEntries(fieldDefinitions.map(({ key }) => [key, null]));
}
