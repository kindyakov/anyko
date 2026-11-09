import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import PizZip from 'pizzip';

import {
  candidateSchema,
  emptyFieldValues,
  fieldValuesSchema,
} from '@anyko/contracts';

import { generateDocument } from '../src/modules/generation';
import {
  availablePackages,
  requirePackage,
  templateBytes,
  templateData,
} from '../src/modules/templates';

test('the selectable package contains three real versioned templates; archived single-document works still resolve', () => {
  const packages = availablePackages();
  expect(packages).toHaveLength(1);
  expect(packages[0]?.technical).toBe(false);
  expect(packages[0]?.documents.map((doc) => doc.id)).toEqual([
    'statement',
    'inventory',
    'creditors',
  ]);
  expect(requirePackage('technical-document-v1').documents).toHaveLength(1);
  expect(() => requirePackage('not-a-package')).toThrow('PACKAGE_NOT_FOUND');
});

test('each DOCX keeps its source styles, page geometry and structured tables and renders the shared identity and repeated rows', () => {
  const pack = requirePackage('bfl-bankruptcy-v3');
  const values = emptyFieldValues();
  Object.assign(values, {
    lastName: 'Тестовый',
    firstName: 'Пётр',
    middleName: 'Сергеевич',
    documentNumber: '0000 123456',
    documentDate: '05.11.2026',
    debts: [
      {
        name: 'Синтетический кредитор А',
        basis: 'Договор А',
        amount: '100.00',
      },
      {
        name: 'Синтетический кредитор Б',
        basis: 'Договор Б',
        amount: '200.00',
      },
    ],
    realEstate: [
      { description: 'Синтетическая квартира А', address: 'Адрес А' },
      { description: 'Синтетическая квартира Б', address: 'Адрес Б' },
    ],
  });
  for (const template of pack.documents) {
    const source = templateBytes(template.version);
    expect(createHash('sha256').update(source).digest('hex')).toBe(
      template.checksum,
    );
    const zip = new PizZip(source);
    const rendered = new PizZip(generateDocument(source, templateData(values)));
    const xml = rendered.file('word/document.xml')?.asText() ?? '';
    expect(xml).toContain('Тестовый');
    expect(xml).toContain('Пётр');
    expect(xml).toContain('Сергеевич');
    expect(xml).toContain('05.11.2026');
    expect(xml).not.toMatch(/\{[#/a-zA-Z][^}]*\}/);
    for (const part of [
      'word/styles.xml',
      'word/numbering.xml',
      'word/theme/theme1.xml',
    ])
      expect(rendered.file(part)?.asText()).toBe(zip.file(part)?.asText());
    expect(xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0]).toBe(
      zip
        .file('word/document.xml')
        ?.asText()
        .match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0],
    );
    if (template.id !== 'inventory') {
      expect(xml).toContain('Синтетический кредитор А');
      expect(xml).toContain('Синтетический кредитор Б');
    }
    if (template.id === 'inventory') {
      expect(xml).toContain('Синтетическая квартира А');
      expect(xml).toContain('Синтетическая квартира Б');
    }
  }
});

test('unknown collections do not become absence, and an empty package never contains source-case defaults', () => {
  const values = emptyFieldValues();
  const pack = requirePackage('bfl-bankruptcy-v3');
  const unknown =
    new PizZip(
      generateDocument(templateBytes('bfl-inventory-v1'), templateData(values)),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(unknown).toContain('[не заполнено]');
  expect(unknown).not.toContain('Отсутствует');
  values.realEstate = [];
  const absent =
    new PizZip(
      generateDocument(templateBytes('bfl-inventory-v1'), templateData(values)),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(absent).toContain('Отсутствует');
  for (const template of pack.documents) {
    const zip = new PizZip(templateBytes(template.version));
    expect(zip.file('docProps/core.xml')?.asText()).not.toMatch(
      /<dc:creator|<cp:lastModifiedBy/,
    );
    expect(zip.file('word/document.xml')?.asText()).toContain('{lastName}');
  }
});

test('runtime field validation rejects mixing text and tables and unknown columns', () => {
  expect(
    fieldValuesSchema.safeParse({ ...emptyFieldValues(), debts: 'text' })
      .success,
  ).toBe(false);
  expect(
    fieldValuesSchema.safeParse({
      ...emptyFieldValues(),
      firstName: [{ name: 'wrong' }],
    }).success,
  ).toBe(false);
  expect(
    candidateSchema.safeParse({
      field: 'debts',
      value: [{ accountPassword: 'forbidden column' }],
      evidence: [
        { documentId: crypto.randomUUID(), imagePath: null, quote: 'text' },
      ],
    }).success,
  ).toBe(false);
});

test('the chosen request and explicit absence of attachments cannot be contradicted by a source-case default', () => {
  const values = {
    ...emptyFieldValues(),
    requestsDetails: 'Ввести процедуру реструктуризации долгов',
    attachments: [],
  };
  const xml =
    new PizZip(
      generateDocument(templateBytes('bfl-statement-v3'), templateData(values)),
    )
      .file('word/document.xml')
      ?.asText() ?? '';
  expect(xml).toContain('Ввести процедуру реструктуризации долгов');
  expect(xml).not.toContain(
    'Признать меня банкротом и ввести процедуру реализации имущества гражданина',
  );
  expect(xml).not.toContain('прилагаю');
  expect(xml).not.toContain('подтверждаются приложенными документами');
});
