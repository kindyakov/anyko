import { expect, test } from 'bun:test';

import { strFromU8, unzipSync } from 'fflate';

import {
  previewDocumentValues,
  previewStatementValues,
} from '../../apps/web/src/features/fact-review/model/preview';
import { generateDocument } from '../../packages/backend/src/modules/generation';
import {
  requirePackage,
  templateBytes,
  templateData,
} from '../../packages/backend/src/modules/templates';
import { readFieldValues } from '../../packages/backend/src/profiles/bfl/fields';
import providerFixtures from '../fixtures/bfl-acceptance/provider-fixtures.json';

const referenceDate = '2026-11-21';
const identity = Object.fromEntries(
  providerFixtures.dismissed.candidates
    .filter(({ field }) =>
      ['firstName', 'lastName', 'middleName', 'citizenship'].includes(field),
    )
    .map(({ field, value }) => [field, value]),
);
const facts = readFieldValues({
  ...identity,
  documentDate: '21.11.2026',
  inn: null,
  previousNames: 'ФИО не менялись.',
  realEstate: [
    {
      category: 'квартира',
      description: 'Квартира в тестовом доме А',
      identifier: '00:00:0000000:87',
      ownership: 'Долевая',
      area: '33,1',
    },
    {
      category: 'квартира',
      description: 'Квартира в тестовом доме Б',
      ownership: 'Индивидуальная',
      area: '42,8',
    },
  ],
  vehicles: null,
  cashOnHand: '21000.00',
  debts: [
    {
      name: 'АО "ТЕСТОВЫЙ БАНК"',
      type: 'Кредит',
      contractNumber: 'TEST-87',
      contractDate: '01.03.2025',
      amount: '12000.50',
    },
  ],
  businessDebts: [],
});

function paragraphText(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>.*?<\/w:p>/gsu)].map(
    ([paragraph]) =>
      [
        ...paragraph.matchAll(
          /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(br|tab)(?:\s[^>]*)?\/>/gu,
        ),
      ]
        .map(
          ([, text, separator]) => text ?? (separator === 'tab' ? '\t' : '\n'),
        )
        .join(''),
  );
}

function docxTextAndTables(bytes: Uint8Array): string {
  const part = unzipSync(bytes)['word/document.xml'];
  if (!part) throw new Error('Missing word/document.xml');
  const xml = strFromU8(part);
  return [
    ...xml.matchAll(
      /<w:tbl(?:\s[^>]*)?>.*?<\/w:tbl>|<w:p(?:\s[^>]*)?>.*?<\/w:p>/gsu,
    ),
  ]
    .flatMap(([block]) => {
      if (!block.startsWith('<w:tbl'))
        return paragraphText(block)
          .map((text) => text.trimEnd())
          .filter(Boolean);
      const rows = [...block.matchAll(/<w:tr(?:\s[^>]*)?>.*?<\/w:tr>/gsu)].map(
        ([row]) =>
          [...row.matchAll(/<w:tc(?:\s[^>]*)?>.*?<\/w:tc>/gsu)]
            .map(([cell]) => {
              const span = /<w:gridSpan w:val="(\d+)"\s*\/>/u.exec(cell)?.[1];
              const merge = /<w:vMerge(?: w:val="([^"]+)")?\s*\/>/u.exec(cell);
              const text = paragraphText(cell).join('\n');
              return [
                ...(span ? [`span=${span}`] : []),
                ...(merge ? [`merge=${merge[1] ?? 'continue'}`] : []),
                JSON.stringify(text),
              ].join(' ');
            })
            .join(' | '),
      );
      return ['<table>', ...rows, '</table>'];
    })
    .join('\n');
}

for (const version of ['bfl-bankruptcy-v12', 'bfl-bankruptcy-v14']) {
  const pack = requirePackage(version);
  for (const id of ['statement', 'inventory', 'creditors']) {
    const document = pack.documents.find((item) => item.id === id);
    if (!document) throw new Error(`Missing ${version} ${id}`);
    test(`${version} ${id} keeps the reference DOCX text and tables`, () => {
      const bytes = generateDocument(
        templateBytes(document.version),
        templateData(facts, document.version, document.placeholders, {
          fields: pack.fields,
          referenceDate,
        }),
      );
      expect(docxTextAndTables(bytes)).toMatchSnapshot();
    });
  }

  test(`${version} keeps the values of computed preview slots`, () => {
    function preview(id: string) {
      const document = pack.documents.find((item) => item.id === id);
      if (!document) throw new Error(`Missing ${version} ${id}`);
      const result = previewDocumentValues(
        document.version,
        previewStatementValues(pack, id, facts),
        pack.fields,
      );
      if (!result) throw new Error(`Missing ${version} ${id} preview values`);
      return result;
    }

    const statement = preview('statement');
    expect(statement.text('debtTotal')).toBe('12 000,50');
    expect(statement.text('debtorAddress')).toBe('[не заполнено]');

    const inventory = preview('inventory');
    expect(inventory.value('apartments')).toMatchObject([
      {
        rowNumber: '1',
        description:
          version === 'bfl-bankruptcy-v12'
            ? 'Квартира в тестовом доме А'
            : 'Квартира в тестовом доме А, кадастровый номер 00:00:0000000:87',
        ownership: 'Долевая',
        area: '33,1',
      },
      {
        rowNumber: '2',
        description: 'Квартира в тестовом доме Б',
        ownership: 'Индивидуальная',
        area: '42,8',
      },
    ]);
    expect(inventory.value('cars')).toMatchObject([
      { rowNumber: '-', description: '[не заполнено]' },
    ]);
    expect(inventory.value('houses')).toMatchObject([
      { rowNumber: '-', description: '-' },
    ]);
    expect(inventory.value('cash')).toMatchObject([
      { description: 'Наличные денежные средства', amount: '21 000,00 руб.' },
    ]);

    const creditors = preview('creditors');
    expect(creditors.value('debts')).toMatchObject([
      {
        name: 'АО «Тестовый Банк»',
        amount: '12 000,50',
        basis:
          'по кредитному договору № TEST-87 от 01.03.2025 г. в размере 12 000,50 руб., подтверждение: [не заполнено]',
      },
    ]);
    expect(creditors.value('businessDebts')).toMatchObject([
      { rowNumber: '-', name: '-', type: '-', amount: '-' },
    ]);
  });
}
