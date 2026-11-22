import { type AnalysisPlan, validateAnalysisPlan } from '../analysis-plan';

import { attachmentInstructions } from './attachment-instructions';
import { employmentInstructions } from './employment-instructions';
import { factInstructions } from './fact-instructions';
import type { FieldDefinition } from './fields';
import { obligationInstructions } from './obligation-instructions';

const manualFields = new Set([
  'documentDate',
  'sroName',
  'sroAddress',
  'sroPostalAddress',
  'sroContacts',
  'submittedAttachments',
]);

export function bflAnalysisPlan(
  version: string,
  fields: readonly FieldDefinition[],
): AnalysisPlan | undefined {
  if (version !== 'bfl-bankruptcy-v13') return undefined;
  const definitions = fields.filter(({ key }) => !manualFields.has(key));
  const forKeys = (keys: readonly string[]) =>
    definitions.filter(({ key }) => keys.includes(key));
  const steps: AnalysisPlan['steps'] = [
    {
      key: 'identity',
      title: 'Личность и паспорт',
      kind: 'collect',
      fields: [
        'documentNumber',
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
      ],
      instructions:
        'Извлеки сведения должника. Отличай должника от кредитора, представителя и членов семьи.',
    },
    {
      key: 'registration',
      title: 'Регистрация и суд',
      kind: 'collect',
      fields: [
        'postalCode',
        'region',
        'district',
        'city',
        'locality',
        'street',
        'house',
        'building',
        'apartment',
        'courtName',
        'courtAddress',
      ],
      instructions:
        'Извлеки адрес регистрации. Для суда передай субъект РФ в официальный поиск и предложи подтверждённый вариант с основанием по адресу. Оставь выводы на проверку.',
      lookups: ['court'],
    },
    {
      key: 'obligations',
      title: 'Кредиторы и обязательства',
      kind: 'collect',
      fields: [
        'debts',
        'businessDebts',
        'receivables',
        'businessReceivables',
        'mandatoryPayments',
        'businessPayments',
        'refunds',
        'businessRefunds',
      ],
      instructions: obligationInstructions(definitions),
      lookups: ['creditor'],
    },
    {
      key: 'employment',
      title: 'Работа и доход',
      kind: 'collect',
      fields: ['employmentHistory', 'employmentIncome'],
      instructions: employmentInstructions(definitions),
    },
    {
      key: 'family',
      title: 'Семья',
      kind: 'collect',
      fields: ['familyDetails'],
      instructions:
        'Сформулируй подтверждённые сведения о семье и иждивенцах от первого лица, сохрани дословные цитаты.',
    },
    {
      key: 'property',
      title: 'Имущество и сделки',
      kind: 'collect',
      fields: [
        'realEstate',
        'vehicles',
        'accounts',
        'equity',
        'securities',
        'valuables',
        'cashOnHand',
        'propertyDetails',
        'majorTransactionsDetails',
        'companyParticipationDetails',
      ],
      instructions: attachmentInstructions(fields, 'property'),
    },
    {
      key: 'circumstances',
      title: 'Ответственность и обстоятельства',
      kind: 'collect',
      fields: ['liabilityDetails', 'criminalCasesDetails', 'insolvencyDetails'],
      instructions:
        'Переноси только подтверждённые обстоятельства, включая явные отрицания с цитатой.',
    },
    {
      key: 'attachments',
      title: 'Приложения',
      kind: 'collect',
      fields: ['attachments'],
      instructions: attachmentInstructions(fields, 'attachments'),
    },
    {
      key: 'consistency',
      title: 'Сверка согласованности',
      kind: 'review',
      fields: [],
      instructions:
        'Сверь лицо, адрес, реквизиты и суммы между разделами. Отметь расхождения с обеими цитатами для юриста.',
    },
  ];
  return validateAnalysisPlan(
    {
      revision: 'bfl-v13-steps-3',
      steps: steps.map((step) => ({
        ...step,
        instructions: [
          step.instructions,
          factInstructions(forKeys(step.fields)),
        ]
          .filter(Boolean)
          .join(' '),
      })),
    },
    definitions.map(({ key }) => key),
  );
}
