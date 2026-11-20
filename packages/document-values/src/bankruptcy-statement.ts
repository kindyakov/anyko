import { incline } from 'lvovich';

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
    {
      last: filled(values.lastName),
      first: filled(values.firstName),
      middle: filled(values.middleName),
    },
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
