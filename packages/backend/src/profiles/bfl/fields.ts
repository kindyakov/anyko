import { z } from 'zod';

import {
  creditorRegistryColumns,
  obligationColumns,
} from '@anyko/document-values/obligations';

import type { FieldColumn, FieldDefinition, ValueDefinition } from '../fields';

export type { FieldDefinition } from '../fields';

const scalar = (key: FieldKey, label: string, multiline = false) => ({
  key,
  label,
  multiline,
  kind: 'text' as const,
  limits: { maxLength: 12000 },
  columns: [],
});
// These four keys keep previously saved technical works readable.
export const legacyFieldKeys = [
  'personName',
  'documentNumber',
  'documentDate',
  'observations',
] as const;
const scalarFields = {
  personName: { label: 'ФИО полностью', role: 'debtor' },
  documentNumber: {
    label: 'Серия и номер паспорта',
    valueType: 'passport',
    role: 'debtor',
  },
  documentDate: { label: 'Дата подписания', valueType: 'date' },
  observations: { label: 'Дополнительные сведения' },
  courtName: { label: 'Наименование суда', role: 'court' },
  courtAddress: { label: 'Адрес суда', valueType: 'address', role: 'court' },
  lastName: { label: 'Фамилия', role: 'debtor' },
  firstName: { label: 'Имя', role: 'debtor' },
  middleName: { label: 'Отчество', role: 'debtor' },
  previousNames: { label: 'Прежние ФИО', role: 'debtor' },
  birthDate: { label: 'Дата рождения', valueType: 'date', role: 'debtor' },
  birthPlace: { label: 'Место рождения', role: 'debtor' },
  citizenship: { label: 'Гражданство', role: 'debtor' },
  passportIssuer: { label: 'Кем выдан паспорт', role: 'debtor' },
  passportIssuedAt: {
    label: 'Дата выдачи паспорта',
    valueType: 'date',
    role: 'debtor',
  },
  passportDepartment: { label: 'Код подразделения', role: 'debtor' },
  snils: { label: 'СНИЛС', valueType: 'snils', role: 'debtor' },
  inn: { label: 'ИНН', valueType: 'inn', innLength: 12, role: 'debtor' },
  registrationAddress: {
    label: 'Адрес регистрации и проживания',
    valueType: 'address',
    role: 'debtor',
  },
  postalCode: { label: 'Почтовый индекс', role: 'debtor' },
  region: { label: 'Субъект РФ', role: 'debtor' },
  district: { label: 'Район', role: 'debtor' },
  city: { label: 'Город', role: 'debtor' },
  locality: { label: 'Населённый пункт', role: 'debtor' },
  street: { label: 'Улица', role: 'debtor' },
  house: { label: 'Дом', role: 'debtor' },
  building: { label: 'Корпус', role: 'debtor' },
  apartment: { label: 'Квартира', role: 'debtor' },
  debtAsOfDate: { label: 'Дата расчёта задолженности', valueType: 'date' },
  debtTotal: {
    label: 'Общая задолженность, рубли с копейками',
    valueType: 'money',
  },
  debtTotalWords: { label: 'Сумма задолженности прописью' },
  employmentDetails: { label: 'Работа и доход' },
  familyDetails: { label: 'Семейное положение и иждивенцы' },
  companyParticipationDetails: {
    label: 'Участие в организациях и сделки с долями',
  },
  majorTransactionsDetails: { label: 'Сделки за три года' },
  liabilityDetails: { label: 'Административная ответственность' },
  criminalCasesDetails: { label: 'Уголовные дела и судимость' },
  insolvencyDetails: { label: 'Обстоятельства неплатёжеспособности' },
  propertyDetails: { label: 'Обстоятельства имущественного положения' },
  cashOnHand: { label: 'Наличные денежные средства, руб.', valueType: 'money' },
  sroName: { label: 'Наименование СРО', role: 'sro' },
  sroAddress: {
    label: 'Юридический адрес СРО',
    valueType: 'address',
    role: 'sro',
  },
  sroPostalAddress: {
    label: 'Почтовый адрес СРО',
    valueType: 'address',
    role: 'sro',
  },
  sroContacts: { label: 'Контакты СРО', role: 'sro' },
  requestsDetails: { label: 'Просительная часть заявления' },
} satisfies Record<string, ValueDefinition & { label: string; role?: string }>;
type ColumnDescription = Omit<FieldColumn, 'key' | 'maxLength'>;
const columns = (
  definitions: Record<string, string | ColumnDescription>,
): FieldColumn[] =>
  Object.entries(definitions).map(([key, definition]) => ({
    key,
    ...(typeof definition === 'string' ? { label: definition } : definition),
    maxLength: 4000,
  }));
const obligationColumnsBase = columns({
  type: 'Содержание обязательства',
  name: 'Кредитор / должник',
  address: { label: 'Адрес', valueType: 'address' },
  ogrn: 'ОГРН',
  inn: { label: 'ИНН', valueType: 'inn' },
  basis: 'Договор, номер, дата',
  amount: { label: 'Всего, руб.', valueType: 'money' },
  arrears: { label: 'Задолженность, руб.', valueType: 'money' },
  penalties: { label: 'Санкции, руб.', valueType: 'money' },
  proof: 'Подтверждающий документ, дата',
});
const bankObligationColumns = [
  ...obligationColumnsBase,
  ...columns({
    ...obligationColumns,
    contractDate: {
      label: obligationColumns.contractDate,
      valueType: 'date',
      evidence: 'row',
    },
    amountDate: {
      label: obligationColumns.amountDate,
      valueType: 'date',
      evidence: 'row',
    },
    interest: { label: obligationColumns.interest, valueType: 'money' },
  }),
  ...columns(creditorRegistryColumns),
];
const paymentColumns = columns({
  name: 'Наименование платежа',
  amount: { label: 'Недоимка / возврат, руб.', valueType: 'money' },
  penalties: { label: 'Санкции / проценты, руб.', valueType: 'money' },
});
const collectionLabels = {
  employmentHistory: {
    label: 'Кадровые записи из трудовой книжки',
    columns: columns({
      employer: 'Работодатель',
      date: { label: 'Дата записи', valueType: 'date' },
      event: 'Приём / увольнение',
    }),
    identity: ['employer', 'date', 'event'],
  },
  employmentIncome: {
    label: 'Доход по месяцам и работодателям до вычета налога',
    columns: columns({
      employer: 'Работодатель',
      month: 'Месяц (ГГГГ-ММ)',
      code: 'Код дохода',
      amount: { label: 'Начислено, руб.', valueType: 'money' },
      sourceLine: 'Дословная строка начисления при совпадении месяца и кода',
    }),
    identity: ['employer', 'month', 'code'],
  },
  debts: {
    label: 'Кредиторы: личные обязательства',
    columns: bankObligationColumns,
    identity: ['name', 'basis'],
  },
  businessDebts: {
    label: 'Кредиторы: предпринимательские обязательства',
    columns: bankObligationColumns,
    identity: ['name', 'basis'],
  },
  receivables: {
    label: 'Должники: личные обязательства',
    columns: obligationColumnsBase,
    identity: ['name', 'basis'],
  },
  businessReceivables: {
    label: 'Должники: предпринимательские обязательства',
    columns: obligationColumnsBase,
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
      identifier: 'Кадастровый номер',
      category:
        'Подраздел: земельный участок, жилой дом, квартира, гараж или иное',
      ownership: 'Вид собственности',
      address: { label: 'Адрес', valueType: 'address' },
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
      category:
        'Вид транспорта: легковой автомобиль, грузовой автомобиль, мототранспорт, сельхозтехника, водный, воздушный или иной',
      identifier: 'Идентификационный номер',
      ownership: 'Вид собственности',
      address: { label: 'Место хранения', valueType: 'address' },
      amount: { label: 'Стоимость, руб.', valueType: 'money' },
      pledge: 'Залог и залогодержатель',
    }),
    identity: ['identifier', 'description'],
  },
  accounts: {
    label: 'Банковские счета',
    columns: columns({
      name: 'Банк и адрес',
      type: 'Вид и валюта счёта',
      openedAt: { label: 'Дата открытия', valueType: 'date', evidence: 'row' },
      amount: { label: 'Остаток, руб.', valueType: 'money' },
    }),
    identity: ['name', 'type', 'openedAt'],
  },
  equity: {
    label: 'Участие в организациях',
    columns: columns({
      name: 'Наименование и форма',
      address: { label: 'Адрес', valueType: 'address' },
      amount: { label: 'Капитал, руб.', valueType: 'money' },
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
      amount: { label: 'Общая стоимость, руб.', valueType: 'money' },
    }),
    identity: ['type', 'name'],
  },
  valuables: {
    label: 'Наличные и ценное имущество',
    columns: columns({
      description: 'Вид и наименование',
      category:
        'Подраздел: драгоценности, предметы искусства, имущество для профессиональных занятий или иное',
      amount: {
        label: 'Стоимость и валюта',
        valueType: 'money',
        moneyFormat: 'sourceCurrency',
        evidence: 'sourceCurrency',
      },
      address: { label: 'Место хранения', valueType: 'address' },
      pledge: 'Залог и залогодержатель',
    }),
    identity: ['description', 'address'],
  },
  attachments: {
    label: 'Приложения к заявлению',
    columns: columns({
      description: 'Наименование, реквизиты, оригинал / копия',
      category: 'Назначение документа',
    }),
    identity: ['description'],
  },
  submittedAttachments: {
    label: 'Подаваемые приложения',
    columns: columns({
      documentId: 'Файл работы',
      description: 'Наименование и реквизиты',
      category: 'Назначение',
      copyKind: 'Вид подаваемого экземпляра',
    }),
    identity: ['documentId'],
  },
} as const;
const fieldKeySchema = z.enum([
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
  'employmentHistory',
  'employmentIncome',
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
  'cashOnHand',
  'attachments',
  'submittedAttachments',
]);
export type FieldKey = z.infer<typeof fieldKeySchema>;
export const fieldDefinitions: (FieldDefinition & { key: FieldKey })[] = [
  ...Object.entries(scalarFields).map(([key, definition]) => ({
    ...scalar(
      fieldKeySchema.parse(key),
      definition.label,
      key.endsWith('Details') || key === 'observations',
    ),
    ...definition,
  })),
  ...Object.entries(collectionLabels).map(([key, definition]) => ({
    ...scalar(fieldKeySchema.parse(key), definition.label),
    kind: 'rows' as const,
    limits: { maxRows: 100 },
    columns: definition.columns,
  })),
];
const fieldsByKey = new Map<string, FieldDefinition>(
  fieldDefinitions.map((field) => [field.key, field]),
);
export const bflField = (key: string) => fieldsByKey.get(key);
export const isCalendarDateField = (key: string) =>
  bflField(key)?.valueType === 'date';
export const isRublesField = (key: string) =>
  bflField(key)?.valueType === 'money';
const fieldRowSchema = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),
  z.string().max(4000).nullable(),
);
const fieldValueSchema = z
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
      if (issue === 'UNKNOWN_COLUMN' && Array.isArray(value)) {
        const definition = fieldDefinitions.find((field) => field.key === key);
        for (const [index, row] of value.entries()) {
          for (const column of Object.keys(row)) {
            if (!definition?.columns.some((allowed) => allowed.key === column))
              ctx.addIssue({
                code: 'custom',
                path: [key, index, column],
                message: issue,
              });
          }
        }
      } else if (issue) {
        ctx.addIssue({ code: 'custom', path: [key], message: issue });
      }
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
