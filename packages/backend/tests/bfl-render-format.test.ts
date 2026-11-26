import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import {
  formatBankruptcyScalar,
  formatCreditorText,
} from '@anyko/document-values/bankruptcy-format';
import { missingTemplateValue } from '@anyko/document-values/template-value';
import { createLogger } from '@anyko/logger';

import providerFixtures from '../../../tests/fixtures/bfl-acceptance/provider-fixtures.json';
import { generateDocument } from '../src/modules/generation';
import { requirePackage, templateBytes } from '../src/modules/templates';
import { emptyFieldValues, readFieldValues } from '../src/profiles/bfl/fields';

import { templateData } from './helpers/template-data';

const partialFacts = readFieldValues(
  Object.fromEntries(
    providerFixtures.dismissed.candidates
      .filter(({ field }) =>
        ['firstName', 'lastName', 'citizenship'].includes(field),
      )
      .map(({ field, value }) => [field, value]),
  ),
);

const packageV14 = requirePackage('bfl-bankruptcy-v14');

function docxParagraphs(docx: Uint8Array) {
  const xml = new PizZip(docx).file('word/document.xml')?.asText();
  if (!xml) throw new Error('Missing word/document.xml');
  return Array.from(
    xml.matchAll(/<w:p(?:\s[^>]*)?>.*?<\/w:p>/gsu),
    ([paragraph]) =>
      Array.from(
        paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu),
        (match) => match[1],
      ).join(''),
  );
}

for (const [scenario, facts] of [
  ['empty facts', emptyFieldValues()],
  ['partial acceptance facts', partialFacts],
] as const) {
  for (const { id, version, placeholders } of packageV14.documents) {
    test(`BFL v14 ${id} prints filling lines for ${scenario}`, () => {
      const docx = generateDocument(
        templateBytes(version),
        templateData(facts, version, placeholders, {
          fields: packageV14.fields,
          referenceDate: '21.11.2026',
        }),
      );
      const paragraphs = docxParagraphs(docx);
      const text = paragraphs.join('\n');
      expect(
        text.match(/\[[^\]\n]+\]|\{[^}\n]+\}|\b(?:undefined|null|NaN)\b/gu) ??
          [],
      ).toEqual([]);
      expect(text).toMatch(/(?<!_)_{14}(?!_)/u);
      if (id === 'statement') {
        expect(text).toMatch(/ИНН[^\S\n]*:?[^\S\n]*_{14}(?!_)/iu);
        expect(text).toContain('по адресу: ______________');
        expect(paragraphs.some((text) => /^_{45,}$/u.test(text))).toBe(true);
        expect(text).toContain(
          scenario === 'empty facts'
            ? 'гражданство: ______________'
            : 'гражданин Российской Федерации',
        );
      } else {
        expect(paragraphs).toContain('-');
      }
    });
  }
}

test('three missing projected statements after the SRO paragraph occupy three full lines', () => {
  const statement = packageV14.documents.find(({ id }) => id === 'statement');
  if (!statement) throw new Error('Missing statement');
  const { version } = statement;
  const paragraphs = docxParagraphs(
    generateDocument(templateBytes(version), {
      ...templateData(partialFacts, version, statement.placeholders),
      liabilityDetails: missingTemplateValue,
      criminalCasesDetails: missingTemplateValue,
      propertyDetails: missingTemplateValue,
    }),
  ).filter(Boolean);
  const index = paragraphs.findIndex((text) =>
    text.startsWith('Я, как должник, предлагаю'),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const lines = paragraphs.slice(index + 1, index + 4);
  expect(lines).toHaveLength(3);
  for (const line of lines) expect(line).toMatch(/^_{45,}$/u);
});

test('DOCX formatting follows each tag occurrence and suppresses technical scalar values', () => {
  const zip = new PizZip(templateBytes('technical-document-v1'));
  const xml = zip.file('word/document.xml')?.asText();
  if (!xml) throw new Error('Missing fixture XML');
  const body = [
    '<w:p><w:r><w:t>{person</w:t></w:r><w:r><w:t>Name}</w:t></w:r></w:p>',
    ...[
      'Имя: {personName}',
      'Номер: {documentNumber}',
      'Дата: {documentDate}',
      'Адрес: {registrationAddress}',
      'Гражданство: {citizenship}',
      'ИНН: {inn}',
      'Суммы: {debts}',
      'Код: {postalCode}',
      'Регион: {missingRegion}',
      'Описание: {observations}',
    ].map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`),
  ].join('');
  zip.file(
    'word/document.xml',
    xml.replace(/(<w:body>).*?(<w:sectPr>)/su, `$1${body}$2`),
  );
  const events: string[] = [];
  const logger = createLogger(
    { service: 'worker', environment: 'test', release: 'test', level: 'warn' },
    { write: (line) => events.push(line) },
  );
  const paragraphs = docxParagraphs(
    generateDocument(
      zip.generate({ type: 'uint8array' }),
      {
        ...emptyFieldValues(),
        personName: missingTemplateValue,
        documentNumber: 'undefined',
        documentDate: 'null',
        registrationAddress: 'NaN',
        citizenship: '[object Object]',
        inn: '{inn}',
        debts: [{ name: 'Банк' }],
        observations: 'Сведения [из договора]',
      },
      { logger, templateVersion: 'technical-document-v1' },
    ),
  );
  const [standalone, ...inline] = paragraphs;
  expect(standalone).toMatch(/^_{45,}$/u);
  expect(inline).toEqual([
    'Имя: ______________',
    'Номер: ______________',
    'Дата: ______________',
    'Адрес: ______________',
    'Гражданство: ______________',
    'ИНН: ______________',
    'Суммы: ______________',
    'Код: ______________',
    'Регион: ______________',
    'Описание: Сведения [из договора]',
  ]);
  const fields = [
    'documentNumber',
    'documentDate',
    'registrationAddress',
    'citizenship',
    'inn',
    'debts',
    'postalCode',
    'missingRegion',
  ];
  expect(events).toHaveLength(fields.length);
  for (const [index, event] of events.entries()) {
    expect(JSON.parse(event)).toMatchObject({
      level: 40,
      errorCode: 'TEMPLATE_TECHNICAL_VALUE',
      templateVersion: 'technical-document-v1',
      field: fields[index],
    });
    expect(event).not.toMatch(/private|Банк|\[object Object\]|\{inn\}/u);
  }
});

test('blank cell lines follow the cell width, merged grid and run font size', () => {
  const zip = new PizZip(templateBytes('technical-document-v1'));
  const xml = zip.file('word/document.xml')?.asText();
  if (!xml) throw new Error('Missing fixture XML');
  const cell = (properties: string, size: number) =>
    `<w:tc><w:tcPr>${properties}</w:tcPr><w:p><w:r><w:rPr><w:sz w:val="${String(size)}"/></w:rPr><w:t>{personName}</w:t></w:r></w:p></w:tc>`;
  const explicit = cell('<w:tcW w:type="dxa" w:w="1200"/>', 20);
  const merged = cell('<w:gridSpan w:val="2"/>', 20);
  const large = cell('<w:gridSpan w:val="2"/>', 40);
  const table = `<w:tbl><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="1800"/><w:gridCol w:w="1800"/></w:tblGrid><w:tr>${explicit}${merged}</w:tr><w:tr>${explicit}${large}</w:tr></w:tbl>`;
  const automatic = `<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="3000"/></w:tblPr><w:tr>${cell('', 20)}${cell('', 20)}</w:tr></w:tbl>`;
  zip.file(
    'word/document.xml',
    xml.replace('<w:body>', `<w:body>${table}${automatic}`),
  );
  const paragraphs = docxParagraphs(
    generateDocument(zip.generate({ type: 'uint8array' }), {
      ...emptyFieldValues(),
      personName: missingTemplateValue,
    }),
  );
  const lengths = paragraphs.slice(0, 6).map((text) => text.length);
  expect(lengths).toEqual([9, 31, 9, 15, 11, 11]);
});

test('creditor names use sentence case in expanded legal forms and preserve abbreviations', () => {
  expect(
    formatCreditorText('ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "СБЕРБАНК РОССИИ"'),
  ).toBe('Публичное акционерное общество «Сбербанк России»');
  expect(
    formatCreditorText(
      'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ МИКРОКРЕДИТНАЯ КОМПАНИЯ "ОЗОН КРЕДИТ"',
    ),
  ).toBe(
    'Общество с ограниченной ответственностью микрокредитная компания «Озон Кредит»',
  );
  expect(formatCreditorText('ПАО "МТС-БАНК"')).toBe('ПАО «МТС-Банк»');
});

test('passport names of places keep service words and settlement abbreviations lowercase', () => {
  expect(
    formatBankruptcyScalar(
      'passportIssuer',
      'ОТДЕЛОМ УФМС РОССИИ ПО ЛИПЕЦКОЙ ОБЛАСТИ В ЗАДОНСКОМ РАЙОНЕ',
    ),
  ).toBe('Отделом УФМС России по Липецкой области в Задонском районе');
  expect(
    formatBankruptcyScalar(
      'birthPlace',
      'С. ХОХОЛ ХОХОЛЬСКОГО Р-НА ВОРОНЕЖСКОЙ ОБЛ.',
    ),
  ).toBe('с. Хохол Хохольского р-на Воронежской обл.');
  expect(formatBankruptcyScalar('birthPlace', 'П. ТИХИЙ')).toBe('п. Тихий');
  expect(formatBankruptcyScalar('birthPlace', 'Д. БЕРЁЗОВКА')).toBe(
    'д. Берёзовка',
  );
});

test('the creditor list v3 keeps empty-column dashes and prints a line for missing facts', () => {
  const version = 'bfl-creditors-v3';
  const facts = { ...emptyFieldValues(), debts: [], businessDebts: [] };
  const generated = new PizZip(
    generateDocument(templateBytes(version), templateData(facts, version)),
  );
  const xml = generated.file('word/document.xml')?.asText() ?? '';
  const cellContents = Array.from(
    xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu),
    (match) => match[1],
  );
  expect(cellContents).toContain('-');
  expect(cellContents.some((text) => /^_{5,30}$/u.test(text ?? ''))).toBe(true);
  expect(cellContents).not.toContain('[не заполнено]');
  expect(cellContents).not.toContain('—');
});
