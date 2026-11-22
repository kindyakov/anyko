import { incline } from 'lvovich';

import { normalizedPersonName } from './bankruptcy-format';

export const datedBankruptcyPackage = 'bfl-bankruptcy-v8';
export const approvedStatementTemplate = 'bfl-statement-v8';

const defaultSro = {
  sroName: '«МСК СРО ПАУ «Содружество»',
  sroAddress: '355035, г. Ставрополь, пр. Кулакова, 9 б',
  sroPostalAddress:
    '355035, Ставропольский край, г. Ставрополь, пр. Кулакова, д. 9, Б',
  sroContacts: '+7 (8652) 56-03-84, 56-03-85',
};

const filled = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

export function statementSroValues(
  values: Partial<Record<keyof typeof defaultSro, unknown>>,
) {
  const sroName = filled(values.sroName) ?? defaultSro.sroName;
  // При замене организации реквизиты прежней СРО не переносятся.
  const defaults = sroName === defaultSro.sroName ? defaultSro : null;
  return {
    sroName,
    sroAddress: filled(values.sroAddress) ?? defaults?.sroAddress ?? null,
    sroPostalAddress:
      filled(values.sroPostalAddress) ?? defaults?.sroPostalAddress ?? null,
    sroContacts: filled(values.sroContacts) ?? defaults?.sroContacts ?? null,
  };
}

export function statementRequestValues(values: {
  lastName?: unknown;
  firstName?: unknown;
  middleName?: unknown;
}): Record<string, string> {
  const { last, first, middle, gender } = incline(
    statementNameParts(values),
    'accusative',
  );
  return {
    requestDebtorName:
      [last, first, middle].filter(Boolean).join(' ') || '[не заполнено]',
    requestRegistration:
      gender === 'female'
        ? 'зарегистрированную по адресу'
        : gender === 'male'
          ? 'зарегистрированного по адресу'
          : 'адрес регистрации и проживания',
    requestInsolvency:
      gender === 'female'
        ? 'несостоятельной (банкротом)'
        : gender === 'male'
          ? 'несостоятельным (банкротом)'
          : 'банкротом',
  };
}

export function statementNameParts(values: {
  lastName?: unknown;
  firstName?: unknown;
  middleName?: unknown;
}) {
  const part = (input: unknown) => {
    const value = filled(input);
    return value === null ? null : normalizedPersonName(value);
  };
  return {
    last: part(values.lastName),
    first: part(values.firstName),
    middle: part(values.middleName),
  };
}

export function statementDebtorGender(
  values: Parameters<typeof statementNameParts>[0],
) {
  return incline(statementNameParts(values), 'accusative').gender;
}

export function bankruptcyStatement(version: string | undefined) {
  return [
    'bfl-statement-v8',
    'bfl-statement-v9',
    'bfl-statement-v10',
    'bfl-statement-v11',
  ].some((supported) => version === supported);
}
