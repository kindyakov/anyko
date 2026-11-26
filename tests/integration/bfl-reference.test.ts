import { expect, test } from 'bun:test';

import { strFromU8, unzipSync } from 'fflate';

import { generateDocument } from '../../packages/backend/src/modules/generation';
import { readFieldValues } from '../../packages/backend/src/profiles/bfl/fields';
import { createProcessingProfiles } from '../../packages/backend/src/runtime/processing-profiles';
import {
  requirePackage,
  templateBytes,
} from '../../packages/backend/src/runtime/template-assets';
import { prepareTemplate } from '../../packages/document-values/src/template-filling';
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

test('statement filling uses the explicit reference date when the draft has no filing date', () => {
  const pack = requirePackage('bfl-bankruptcy-v14');
  const document = pack.documents.find(({ id }) => id === 'statement');
  if (!document) throw new Error('Missing statement');
  const values = {
    ...facts,
    documentDate: null,
    employmentHistory: [
      { employer: 'ООО Пример', date: '01.11.2026', event: 'Приём' },
      { employer: 'ООО Пример', date: '25.11.2026', event: 'Увольнение' },
    ],
  };
  const definition = { fields: pack.fields, ...document };
  expect(
    prepareTemplate(definition, values, { referenceDate }).scalars
      .employmentDetails,
  ).toContain('осуществляю трудовую деятельность в ООО Пример');
  expect(
    prepareTemplate(definition, values, { referenceDate: '2026-11-30' }).scalars
      .employmentDetails,
  ).toBe('В настоящее время не осуществляю трудовую деятельность.');
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

test('v13 keeps the v12 form text and grid and adds the recorded cadastral number', () => {
  const profiles = createProcessingProfiles(false);
  const archived = profiles.resolve('bfl-bankruptcy-v12');
  const cadastral = profiles.resolve('bfl-bankruptcy-v13');
  const render = (resolved: typeof archived, id: string) => {
    const document = resolved.description.documents.find(
      (item) => item.id === id,
    );
    if (!document) throw new Error(`Missing ${id}`);
    return docxTextAndTables(
      generateDocument(
        resolved.templateBytes(document.version),
        resolved.templateData(facts, document, referenceDate),
      ),
    );
  };
  for (const id of ['statement', 'creditors'])
    expect(render(cadastral, id)).toBe(render(archived, id));
  const inventory = render(archived, 'inventory');
  expect(inventory).toContain('Квартира в тестовом доме А');
  expect(render(cadastral, 'inventory')).toBe(
    inventory.replace(
      'Квартира в тестовом доме А',
      'Квартира в тестовом доме А, кадастровый номер 00:00:0000000:87',
    ),
  );
});

for (const version of ['bfl-bankruptcy-v12', 'bfl-bankruptcy-v14']) {
  const resolved = createProcessingProfiles(false).resolve(version);
  const pack = resolved.description;
  for (const id of ['statement', 'inventory', 'creditors']) {
    const document = pack.documents.find((item) => item.id === id);
    if (!document) throw new Error(`Missing ${version} ${id}`);
    test(`${version} ${id} keeps the reference DOCX text and tables`, () => {
      const bytes = generateDocument(
        templateBytes(document.version),
        // These reference snapshots exercise the shared filling function
        // with direct substitutions. The acceptance goldens exercise
        // the full catalog bindings through the worker.
        resolved.templateData(
          facts,
          { ...document, placeholders: [] },
          referenceDate,
        ),
      );
      expect(docxTextAndTables(bytes)).toMatchSnapshot();
    });
  }

  test(`${version} keeps the values of computed preview slots`, () => {
    function preview(id: string) {
      const document = pack.documents.find((item) => item.id === id);
      if (!document) throw new Error(`Missing ${version} ${id}`);
      return prepareTemplate({ ...document, fields: pack.fields }, facts, {
        referenceDate,
      });
    }

    const statement = preview('statement');
    expect(statement.scalars.debtTotal).toBe('12 000,50');
    expect(statement.scalars.debtorAddress).toBe('[не заполнено]');

    const inventory = preview('inventory');
    expect(inventory.repeating.apartments).toMatchObject([
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
    expect(inventory.repeating.cars).toMatchObject([
      { rowNumber: '-', description: '[не заполнено]' },
    ]);
    expect(inventory.repeating.houses).toMatchObject([
      { rowNumber: '-', description: '-' },
    ]);
    expect(inventory.repeating.cash).toMatchObject([
      { description: 'Наличные денежные средства', amount: '21 000,00 руб.' },
    ]);

    const creditors = preview('creditors');
    expect(creditors.repeating.debts).toMatchObject([
      {
        name: 'АО «Тестовый Банк»',
        amount: '12 000,50',
        basis:
          'по кредитному договору № TEST-87 от 01.03.2025 г. в размере 12 000,50 руб., подтверждение: [не заполнено]',
      },
    ]);
    expect(creditors.repeating.businessDebts).toMatchObject([
      { rowNumber: '-', name: '-', type: '-', amount: '-' },
    ]);
  });
}
