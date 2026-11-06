import { z } from 'zod';

const scalar = (key: FieldKey, label: string, multiline = false) => ({
  key,
  label,
  multiline,
  columns: [],
});
// These four keys keep previously saved technical works readable.
export const legacyFieldKeys = [
  'personName',
  'documentNumber',
  'documentDate',
  'observations',
] as const;
const scalarLabels = {
  personName: 'ФИО полностью',
  documentNumber: 'Серия и номер паспорта',
  documentDate: 'Дата подписания',
  observations: 'Дополнительные сведения',
  courtName: 'Наименование суда',
  courtAddress: 'Адрес суда',
  lastName: 'Фамилия',
  firstName: 'Имя',
  middleName: 'Отчество',
  previousNames: 'Прежние ФИО',
  birthDate: 'Дата рождения',
  birthPlace: 'Место рождения',
  citizenship: 'Гражданство',
  passportIssuer: 'Кем выдан паспорт',
  passportIssuedAt: 'Дата выдачи паспорта',
  passportDepartment: 'Код подразделения',
  snils: 'СНИЛС',
  inn: 'ИНН',
  registrationAddress: 'Адрес регистрации и проживания',
  postalCode: 'Почтовый индекс',
  region: 'Субъект РФ',
  district: 'Район',
  city: 'Город',
  locality: 'Населённый пункт',
  street: 'Улица',
  house: 'Дом',
  building: 'Корпус',
  apartment: 'Квартира',
  debtAsOfDate: 'Дата расчёта задолженности',
  debtTotal: 'Общая задолженность, рубли с копейками',
  debtTotalWords: 'Сумма задолженности прописью',
  employmentDetails: 'Работа и доход',
  familyDetails: 'Семейное положение и иждивенцы',
  companyParticipationDetails: 'Участие в организациях и сделки с долями',
  majorTransactionsDetails: 'Сделки за три года',
  liabilityDetails: 'Административная ответственность',
  criminalCasesDetails: 'Уголовные дела и судимость',
  insolvencyDetails: 'Обстоятельства неплатёжеспособности',
  propertyDetails: 'Обстоятельства имущественного положения',
  sroName: 'Наименование СРО',
  sroAddress: 'Юридический адрес СРО',
  sroPostalAddress: 'Почтовый адрес СРО',
  sroContacts: 'Контакты СРО',
  requestsDetails: 'Просительная часть заявления',
} as const;
const columns = (labels: Record<string, string>) =>
  Object.entries(labels).map(([key, label]) => ({ key, label }));
const obligationColumns = columns({
  type: 'Содержание обязательства',
  name: 'Кредитор / должник',
  address: 'Адрес',
  ogrn: 'ОГРН',
  inn: 'ИНН',
  basis: 'Договор, номер, дата',
  amount: 'Всего, руб.',
  arrears: 'Задолженность, руб.',
  penalties: 'Санкции, руб.',
  proof: 'Подтверждающий документ, дата',
});
const paymentColumns = columns({
  name: 'Наименование платежа',
  amount: 'Недоимка / возврат, руб.',
  penalties: 'Санкции / проценты, руб.',
});
const collectionLabels = {
  debts: {
    label: 'Кредиторы: личные обязательства',
    columns: obligationColumns,
    identity: ['name', 'basis'],
  },
  businessDebts: {
    label: 'Кредиторы: предпринимательские обязательства',
    columns: obligationColumns,
    identity: ['name', 'basis'],
  },
  receivables: {
    label: 'Должники: личные обязательства',
    columns: obligationColumns,
    identity: ['name', 'basis'],
  },
  businessReceivables: {
    label: 'Должники: предпринимательские обязательства',
    columns: obligationColumns,
    identity: ['name', 'basis'],
  },
  mandatoryPayments: {
    label: 'Личные обязательные платежи',
    columns: paymentColumns,
    identity: ['name'],
  },
  businessPayments: {
    label: 'Предпринимательские обязательные платежи',
    columns: paymentColumns,
    identity: ['name'],
  },
  refunds: {
    label: 'Личные платежи к зачёту или возврату',
    columns: paymentColumns,
    identity: ['name'],
  },
  businessRefunds: {
    label: 'Предпринимательские платежи к зачёту или возврату',
    columns: paymentColumns,
    identity: ['name'],
  },
  realEstate: {
    label: 'Недвижимость',
    columns: columns({
      description: 'Вид и наименование',
      ownership: 'Вид собственности',
      address: 'Адрес',
      area: 'Площадь, кв. м',
      basis: 'Основание приобретения и стоимость',
      pledge: 'Залог и залогодержатель',
    }),
    identity: ['description', 'address'],
  },
  vehicles: {
    label: 'Транспорт',
    columns: columns({
      description: 'Вид, марка, модель, год',
      identifier: 'Идентификационный номер',
      ownership: 'Вид собственности',
      address: 'Место хранения',
      amount: 'Стоимость, руб.',
      pledge: 'Залог и залогодержатель',
    }),
    identity: ['identifier', 'description'],
  },
  accounts: {
    label: 'Банковские счета',
    columns: columns({
      name: 'Банк и адрес',
      type: 'Вид и валюта счёта',
      openedAt: 'Дата открытия',
      amount: 'Остаток, руб.',
    }),
    identity: ['name', 'type', 'openedAt'],
  },
  equity: {
    label: 'Участие в организациях',
    columns: columns({
      name: 'Наименование и форма',
      address: 'Адрес',
      amount: 'Капитал, руб.',
      share: 'Доля',
      basis: 'Основание участия',
    }),
    identity: ['name'],
  },
  securities: {
    label: 'Ценные бумаги',
    columns: columns({
      type: 'Вид',
      name: 'Эмитент',
      nominal: 'Номинал, руб.',
      quantity: 'Количество',
      amount: 'Общая стоимость, руб.',
    }),
    identity: ['type', 'name'],
  },
  valuables: {
    label: 'Наличные и ценное имущество',
    columns: columns({
      description: 'Вид и наименование',
      amount: 'Стоимость и валюта',
      address: 'Место хранения',
      pledge: 'Залог и залогодержатель',
    }),
    identity: ['description', 'address'],
  },
  attachments: {
    label: 'Приложения к заявлению',
    columns: columns({
      description: 'Наименование, реквизиты, оригинал / копия',
    }),
    identity: ['description'],
  },
} as const;
export const fieldKeySchema = z.enum([
  'personName',
  'documentNumber',
  'documentDate',
  'observations',
  'courtName',
  'courtAddress',
  'lastName',
  'firstName',
  'middleName',
  'previousNames',
  'birthDate',
  'birthPlace',
  'citizenship',
  'passportIssuer',
  'passportIssuedAt',
  'passportDepartment',
  'snils',
  'inn',
  'registrationAddress',
  'postalCode',
  'region',
  'district',
  'city',
  'locality',
  'street',
  'house',
  'building',
  'apartment',
  'debtAsOfDate',
  'debtTotal',
  'debtTotalWords',
  'employmentDetails',
  'familyDetails',
  'companyParticipationDetails',
  'majorTransactionsDetails',
  'liabilityDetails',
  'criminalCasesDetails',
  'insolvencyDetails',
  'propertyDetails',
  'sroName',
  'sroAddress',
  'sroPostalAddress',
  'sroContacts',
  'requestsDetails',
  'debts',
  'businessDebts',
  'receivables',
  'businessReceivables',
  'mandatoryPayments',
  'businessPayments',
  'refunds',
  'businessRefunds',
  'realEstate',
  'vehicles',
  'accounts',
  'equity',
  'securities',
  'valuables',
  'attachments',
]);
export type FieldKey = z.infer<typeof fieldKeySchema>;
export interface FieldDefinition {
  key: FieldKey;
  label: string;
  multiline: boolean;
  columns: { key: string; label: string }[];
}
export const fieldDefinitions: FieldDefinition[] = [
  ...Object.entries(scalarLabels).map(([key, label]) =>
    scalar(
      fieldKeySchema.parse(key),
      label,
      key.endsWith('Details') || key === 'observations',
    ),
  ),
  ...Object.entries(collectionLabels).map(([key, definition]) => ({
    ...scalar(fieldKeySchema.parse(key), definition.label),
    columns: definition.columns,
  })),
];
export const fieldRowSchema = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),
  z.string().max(4000).nullable(),
);
export const fieldValueSchema = z
  .union([z.string().max(12000), z.array(fieldRowSchema).max(100)])
  .nullable();
export type FieldRow = z.infer<typeof fieldRowSchema>;
export type FieldValue = z.infer<typeof fieldValueSchema>;
export type FieldValues = Record<FieldKey, FieldValue>;
export function fieldValueIssue(key: string, value: FieldValue): string | null {
  const definition = fieldDefinitions.find((field) => field.key === key);
  if (!definition) return 'UNKNOWN_FIELD';
  if (value === null) return null;
  if (!definition.columns.length)
    return typeof value === 'string' ? null : 'EXPECTED_TEXT';
  if (!Array.isArray(value)) return 'EXPECTED_ROWS';
  for (const row of value)
    if (
      Object.keys(row).some(
        (column) =>
          !definition.columns.some((allowed) => allowed.key === column),
      )
    )
      return 'UNKNOWN_COLUMN';
  return null;
}
export const fieldValuesSchema = z
  .record(fieldKeySchema, fieldValueSchema)
  .superRefine((values, ctx) => {
    for (const [key, value] of Object.entries(values)) {
      const issue = fieldValueIssue(key, value);
      if (issue) ctx.addIssue({ code: 'custom', path: [key], message: issue });
    }
  });
// Saved v1 facts predate the package fields. Only persistence readers expand them.
export function emptyFieldValues(): FieldValues {
  return fieldValuesSchema.parse(
    Object.fromEntries(fieldDefinitions.map(({ key }) => [key, null])),
  );
}
export function readFieldValues(input: unknown): FieldValues {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return fieldValuesSchema.parse(input);
  return fieldValuesSchema.parse({ ...emptyFieldValues(), ...input });
}
export function fieldIdentity(key: string): readonly string[] {
  const definition = Object.entries(collectionLabels).find(
    ([name]) => name === key,
  )?.[1];
  return definition?.identity ?? [];
}
