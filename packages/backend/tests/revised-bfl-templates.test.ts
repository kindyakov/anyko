import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import {
  formatBankruptcyScalar,
  formatCreditorText,
} from '@anyko/document-values/bankruptcy-format';
import {
  familyStatement,
  projectBankruptcyCollections,
} from '@anyko/document-values/bankruptcy-projection';

import { generateDocument } from '../src/modules/generation';
import {
  requirePackage,
  templateBytes,
  templateData,
} from '../src/modules/templates';
import { emptyFieldValues } from '../src/profiles/bfl/fields';

test('keeps unknown debt visible while showing a dash for confirmed absence', () => {
  const values = {
    debts: [{ name: 'Банк', amount: '100.00' }],
    businessDebts: null,
  };
  expect(
    projectBankruptcyCollections('bfl-creditors-v2', values, true)
      ?.businessDebts,
  ).toMatchObject([{ rowNumber: '-', name: '-', type: '[не заполнено]' }]);
  expect(
    projectBankruptcyCollections(
      'bfl-creditors-v2',
      { ...values, businessDebts: [] },
      true,
    )?.businessDebts,
  ).toMatchObject([{ rowNumber: '-', name: '-', type: '-' }]);
});

test('formats uppercase segments in mixed-case creditor and issuing office names', () => {
  expect(
    formatBankruptcyScalar(
      'passportIssuer',
      'УМВД России ПО КИРОВСКОЙ ОБЛАСТИ',
    ),
  ).toBe('УМВД России по Кировской области');
  expect(formatCreditorText('ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "Сбербанк"')).toBe(
    'Публичное акционерное общество «Сбербанк»',
  );
});

test('preserves first-person family text and flags third-person drafts without rewriting them', () => {
  const ready =
    'В зарегистрированном браке не состою. Несовершеннолетних детей нет.';
  expect(familyStatement(ready)).toBe(ready);
  for (const draft of [
    'Должник не женат. Детей нет.',
    'Должница замужем, имеет одного ребенка.',
    'Заявитель разведена, на иждивении находится сын.',
    'Иванова сообщила, что в зарегистрированном браке не состоит.',
  ]) {
    expect(familyStatement(draft)).toBe(
      '[проверьте формулировку от первого лица] ' + draft,
    );
  }
});

function renderedText(
  version: string,
  values: ReturnType<typeof emptyFieldValues>,
) {
  const dates = ['birthDate', 'passportIssuedAt', 'documentDate'] as const;
  const zip = new PizZip(
    generateDocument(
      templateBytes(version),
      templateData(
        values,
        version,
        dates.map((key) => ({
          tag: key,
          field: key,
          placeholder: 'DD.MM.YYYY г.',
        })),
      ),
    ),
  );
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu)]
    .map((match) => match[1])
    .join('\n');
}

test('statement v9 keeps the approved frozen templates and composes an address without empty parts', () => {
  expect(requirePackage('bfl-bankruptcy-v8').documents[0]?.version).toBe(
    'bfl-statement-v8',
  );
  expect(requirePackage('bfl-bankruptcy-v9').documents[0]?.version).toBe(
    'bfl-statement-v9',
  );
  const values = {
    ...emptyFieldValues(),
    lastName: 'ИВАНОВА',
    firstName: 'АННА',
    middleName: 'ИВАНОВНА',
    citizenship: 'Российская Федерация',
    birthDate: '05.07.1984',
    passportIssuedAt: '16.09.2004',
    region: 'Липецкая область',
    city: 'г. Задонск',
    house: '17',
    apartment: '1',
  };
  const text = renderedText('bfl-statement-v9', values);
  expect(text).toContain('Липецкая область, г. Задонск, д. 17, кв. 1');
  expect(text).toContain('зарегистрированную и проживающую по адресу');
  expect(text).toContain('с настоящим заявлением о признании себя банкротом');
  expect(text).toContain(
    'гражданин Российской Федерации, 05.07.1984 г. рождения',
  );
  expect(text).toContain(
    'гражданина Российской Федерации, 05.07.1984 г. рождения',
  );
  expect(text).toContain('16.09.2004 г.');
  expect(text).toContain(
    'Я прекратила расчеты с Кредиторами, то есть перестала исполнять денежные обязательства',
  );
  expect(text).toContain('в течение более чем трёх месяцев');
  expect(text).not.toContain('одного месяца');
  expect(text).toContain(
    'Размер моей задолженности превышает стоимость моего имущества, в том числе право требования.',
  );
  expect(text).toContain(
    'Как видно из приведенного выше, общий (совокупный) размер моих обязательств превышает общую стоимость имущества.',
  );
});

test('the statement states insolvency in the grammatical gender of a male debtor', () => {
  const text = renderedText('bfl-statement-v11', {
    ...emptyFieldValues(),
    lastName: 'ИВАНОВ',
    firstName: 'ИВАН',
    middleName: 'ИВАНОВИЧ',
  });
  expect(text).toContain(
    'Я прекратил расчеты с Кредиторами, то есть перестал исполнять денежные обязательства',
  );
  expect(text).not.toContain('перестала');
});

test('statement v10 groups the obligations of one creditor and omits closed contracts', () => {
  const values = {
    ...emptyFieldValues(),
    debts: [
      {
        name: 'Банк',
        creditorShortName: 'АО «Банк»',
        type: 'Кредит',
        amount: '12000.00',
        contractNumber: 'ACTIVE-1',
        contractDate: '01.12.2025',
        proof: 'Справка от 02.11.2026',
      },
      {
        name: 'Банк',
        creditorShortName: 'АО «Банк»',
        type: 'Заём',
        amount: '500.23',
        contractNumber: 'ACTIVE-2',
      },
      {
        name: 'Банк',
        debtStatus: 'Закрыт',
        amount: '100.00',
        contractNumber: 'CLOSED-3',
      },
    ],
  };
  const text = renderedText('bfl-statement-v10', values);
  expect(
    text.match(/Неспособность удовлетворить требования кредитора/gu),
  ).toHaveLength(1);
  expect(text).toContain(
    'по кредитному договору № ACTIVE-1 от 01.12.2025 г. в размере 12 000 руб. (двенадцать тысяч рублей), исходя из справки от 02.11.2026 г.',
  );
  expect(text).toContain('по договору займа № ACTIVE-2 в размере 500,23 руб.');
  expect(text).not.toContain('CLOSED-3');
});

test('inventory v2 keeps category order, repeats apartments and prints cash in section 6.1', () => {
  expect(
    requirePackage('bfl-bankruptcy-v11').fields.some(
      ({ key }) => key === 'cashOnHand',
    ),
  ).toBe(true);
  const text = renderedText('bfl-inventory-v2', {
    ...emptyFieldValues(),
    cashOnHand: '21000.00',
    realEstate: [
      { description: 'Квартира А', ownership: 'Долевая' },
      { description: 'Квартира Б', ownership: 'Индивидуальная' },
    ],
  });
  expect(text).toContain('1.1\nЗемельные участки: -');
  expect(text).toContain('1.3\nКвартиры: Квартира А');
  expect(text).toContain('1.3\nКвартиры: Квартира Б');
  expect(text).toContain('6.1\nНаличные денежные средства\n21 000,00 руб.');
});

test('creditors v3 lists each creditor once per section with every active contract and the same total', () => {
  const first = {
    name: 'АО Банк А',
    creditorShortName: 'АО Банк А',
    creditorLegalName: 'Акционерное общество Банк А',
    inn: '0000000001',
    type: 'Кредит',
    contractNumber: 'A-01',
    contractDate: '01.03.2025',
    proof: 'справка от 20.11.2026',
    amount: '12000.00',
  };
  const values = {
    ...emptyFieldValues(),
    previousNames: 'ФИО не менялись.',
    debts: [
      first,
      { ...first },
      {
        name: 'АО Банк А',
        type: 'Заём',
        contractNumber: 'A-02',
        amount: '600.25',
      },
      { ...first, contractNumber: 'CLOSED', debtStatus: 'Закрыт' },
      { ...first, inn: '0000000002', contractNumber: 'A-03', amount: '80.05' },
    ],
    businessDebts: [{ ...first, contractNumber: 'B-01', amount: '5.00' }],
  };
  const data = templateData(values, 'bfl-creditors-v3');
  expect(data.debts).toMatchObject([
    { rowNumber: '1', amount: '12 600,25', arrears: '-', penalties: '-' },
    { rowNumber: '2', amount: '80,05' },
  ]);
  expect(data.businessDebts).toMatchObject([
    { rowNumber: '1', amount: '5,00' },
  ]);
  expect(data.debtTotal).toBe('12 685,30');

  const output = renderedText('bfl-creditors-v3', values);
  expect(output).toContain(
    'по кредитному договору № A-01 от 01.03.2025 г. в размере 12 000 рублей, исходя из справки от 20.11.2026 г.; по договору займа № A-02',
  );
  expect(output.match(/№ A-01/gu)).toHaveLength(1);
  expect(output).not.toContain('CLOSED');
  expect(output).toContain('Итого по договорам: 12 685,30 руб.');
  expect(templateData(values, 'bfl-creditors-v2').debts).toHaveLength(3);
});

test('revised creditor and inventory forms distinguish unchanged, unknown and previous names', () => {
  for (const version of ['bfl-creditors-v3', 'bfl-inventory-v2']) {
    const values = emptyFieldValues();
    expect(templateData(values, version).previousNames).toBe('[не заполнено]');
    for (const unchanged of [
      '-',
      'ФИО не менялись.',
      'ФИО не менялось',
      'Фамилия не менялась',
      'Не меняла',
      'Фамилия, имя и отчество не изменялись',
    ])
      expect(
        templateData({ ...values, previousNames: unchanged }, version)
          .previousNames,
      ).toBe('-');
    expect(
      templateData({ ...values, previousNames: 'Петрова' }, version)
        .previousNames,
    ).toBe('Петрова');
  }
});
