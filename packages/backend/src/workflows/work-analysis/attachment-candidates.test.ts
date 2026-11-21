import { expect, test } from 'bun:test';

import { debtAttachmentDescription } from '@anyko/document-values/attachments';

import { supportingAttachmentCandidates } from './attachment-candidates';

test('proposes each supporting source, preserving its own evidence and date', () => {
  const sourceTexts = [
    'Российская Федерация\nФамилия Иванов\nИмя Иван\nМесто рождения г. Киров',
    'Форма АДИ\\-РЕГ',
    'Свидетельство о постановке на учёт в налоговом органе',
    'Сведения о трудовой деятельности',
    'Справка о доходах и суммах налога физического лица',
    'Выписка из ЕГРН',
    'Сведения о состоянии индивидуального лицевого счёта',
    'Сведения о регистрации индивидуального лицевого счёта',
  ] as const;
  const sources = sourceTexts.map((text, index) => ({
    id: `source-${index.toString()}`,
    text,
    ocrRevision: 1,
    visuals: [],
  }));
  const makeDebt = (status: string, number: string, documentId: string) => ({
    field: 'debts' as const,
    value: [
      {
        name: 'Банк ВТБ (ПАО)',
        type: 'Кредит',
        contractNumber: number,
        debtStatus: status,
        proof: 'Справка от 21.11.2026',
        amountDate: '01.11.2026',
      },
    ],
    evidence: [{ documentId, imagePath: null, quote: `Договор ${number}` }],
  });
  const proposed = supportingAttachmentCandidates(
    [
      makeDebt('Действует', '42', 'bank'),
      makeDebt('Действует', '43', 'bank'),
      makeDebt('Закрыт', '44', 'closed'),
    ],
    sources,
  );
  expect(
    proposed.map(({ value, evidence }) => ({
      description: Array.isArray(value) ? value[0]?.description : undefined,
      texts: evidence.map(({ documentId, quote }) => [documentId, quote]),
    })),
  ).toEqual([
    {
      description:
        'Справка о размере задолженности по кредитному договору № 42 с Банком ВТБ (ПАО) от 21.11.2026; Справка о размере задолженности по кредитному договору № 43 с Банком ВТБ (ПАО) от 21.11.2026',
      texts: [
        ['bank', 'Договор 42'],
        ['bank', 'Договор 43'],
      ],
    },
    {
      description: 'Паспорт гражданина Российской Федерации',
      texts: [['source-0', sourceTexts[0]]],
    },
    {
      description:
        'Документ о регистрации в системе индивидуального пенсионного учёта (СНИЛС)',
      texts: [['source-1', 'Форма АДИ\\-РЕГ']],
    },
    {
      description:
        'Свидетельство о постановке на учёт в налоговом органе (ИНН)',
      texts: [['source-2', 'Свидетельство о постановке на учёт']],
    },
    {
      description: 'Сведения о трудовой деятельности',
      texts: [['source-3', sourceTexts[3]]],
    },
    {
      description: 'Справка о доходах и суммах налога физического лица',
      texts: [['source-4', sourceTexts[4]]],
    },
    {
      description: 'Выписка из Единого государственного реестра недвижимости',
      texts: [['source-5', sourceTexts[5]]],
    },
    {
      description:
        'Сведения о состоянии индивидуального лицевого счёта застрахованного лица',
      texts: [['source-6', sourceTexts[6]]],
    },
    {
      description:
        'Документ о регистрации в системе индивидуального пенсионного учёта (СНИЛС)',
      texts: [['source-7', sourceTexts[7]]],
    },
  ]);
});

test('uses a grammatical construction for creditor names in attachments', () => {
  const description = (name: string) =>
    debtAttachmentDescription({
      name,
      contractNumber: '42',
      proof: 'Справка от 21.11.2026',
    });
  expect(description('Сбербанк')).toContain('со Сбербанком от');
  expect(description('Кредитная организация')).toContain(
    'с кредитором «Кредитная организация» от',
  );
  expect(description('АО «ТБанк»')).toContain('с АО «ТБанк» от');
});

test('does not substitute the contract date or invent the type in an attachment', () => {
  const row = {
    name: 'ООО «Организация»',
    contractNumber: '42',
    contractDate: '01.01.2021',
    proof:
      'Справка о размере задолженности по договору от 01.01.2021 № 42, выдана 21.11.2026',
  };
  expect(debtAttachmentDescription(row)).toBe(
    'Справка о размере задолженности по договору № 42 с ООО «Организация» от 21.11.2026',
  );
  expect(
    debtAttachmentDescription({
      ...row,
      proof: 'Справка о задолженности по договору от 01.01.2021 № 42',
    }),
  ).not.toContain('01.01.2021');
});

test('keeps the certificate number separately from the loan agreement number', () => {
  const row = {
    name: 'Банк ВТБ (ПАО)',
    type: 'Кредит',
    contractNumber: 'VT-51-02481',
  };
  expect(
    debtAttachmentDescription({
      ...row,
      proof: 'Справка № 5417 от 18.11.2026',
    }),
  ).toBe(
    'Справка о размере задолженности № 5417 по кредитному договору № VT-51-02481 с Банком ВТБ (ПАО) от 18.11.2026',
  );
  expect(
    debtAttachmentDescription({
      ...row,
      proof:
        'Справка о задолженности по договору № VT-51-02481, № справки 5417, выдана 18.11.2026',
    }),
  ).toBe(
    'Справка о размере задолженности № 5417 по кредитному договору № VT-51-02481 с Банком ВТБ (ПАО) от 18.11.2026',
  );
  expect(
    debtAttachmentDescription({
      ...row,
      proof: 'Справка о задолженности по договору № VT-51-02481',
    }),
  ).not.toContain('задолженности №');
  expect(
    debtAttachmentDescription({
      ...row,
      proof: 'Справка о задолженности по кредиту № VT-51-02481',
    }),
  ).not.toContain('задолженности №');
});
