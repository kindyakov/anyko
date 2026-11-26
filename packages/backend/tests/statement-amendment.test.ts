import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import { generateDocument } from '../src/modules/generation';
import { emptyFieldValues } from '../src/profiles/bfl/fields';
import {
  availablePackages,
  requirePackage,
  templateBytes,
} from '../src/runtime/template-assets';

import { templateData } from './helpers/template-data';

test('the cadastral field is enabled only for new-package facts and inventory', () => {
  const archived = requirePackage('bfl-bankruptcy-v12');
  const current = requirePackage('bfl-bankruptcy-v13');
  expect(current.documents).toEqual(archived.documents);
  const cadastralField = (pack: typeof archived) =>
    pack.fields
      .find(({ key }) => key === 'realEstate')
      ?.columns.find(({ key }) => key === 'identifier');
  expect(cadastralField(archived)).toBeUndefined();
  expect(cadastralField(current)?.label).toBe('Кадастровый номер');

  const values = {
    ...emptyFieldValues(),
    realEstate: [
      {
        description: 'Квартира',
        category: 'квартира',
        address: 'г. Тестовый, ул. Новая, д. 1',
        identifier: '48:08:0000000:9000001',
      },
    ],
  };
  const inventoryXml = (pack: typeof archived) => {
    const inventory = pack.documents.find(({ id }) => id === 'inventory');
    if (!inventory) throw new Error('Missing inventory');
    const data = templateData(
      values,
      inventory.version,
      inventory.placeholders,
      {
        fields: pack.fields,
        referenceDate: '2026-11-21',
      },
    );
    return new PizZip(generateDocument(templateBytes(inventory.version), data))
      .file('word/document.xml')
      ?.asText();
  };
  expect(inventoryXml(archived)).not.toContain('48:08:0000000:9000001');
  expect(inventoryXml(current)).toContain(
    'Квартира, кадастровый номер 48:08:0000000:9000001',
  );
});

test('the pagination release keeps v13 pinned and renders v14 layout rules', () => {
  const archived = requirePackage('bfl-bankruptcy-v13');
  const current = availablePackages()[0];
  expect(current?.version).toBe('bfl-bankruptcy-v14');
  if (!current) throw new Error('Missing current package');
  expect(
    archived.documents.map(({ version, checksum }) => [version, checksum]),
  ).toEqual([
    [
      'bfl-statement-v11',
      '2b36b41bacf185bd230667f18b0beda0baf6b1c12cbccb6b98e3707f099ae756',
    ],
    [
      'bfl-inventory-v2',
      '9d806a1764ffdd559a55379b527c340c195d01a62d89a84e0e0b3e7079644fcc',
    ],
    [
      'bfl-creditors-v3',
      '6d1f640e99e08b500ec4cc6273cc26aa399871f4c56d2cca8be570dd1bf516c6',
    ],
  ]);
  expect(current.fields).toEqual(archived.fields);
  expect(current.documents.map(({ version }) => version)).toEqual([
    'bfl-statement-v12',
    'bfl-inventory-v3',
    'bfl-creditors-v4',
  ]);
  for (const entry of archived.documents) templateBytes(entry.version);

  const attachments = ['Первый документ', 'Последний документ'].map(
    (description, index) => ({
      description,
      documentId: `source-${String(index)}`,
      category: 'other',
      copyKind: 'copy',
    }),
  );
  const input = { ...emptyFieldValues(), submittedAttachments: attachments };
  for (const { id, version, placeholders } of current.documents) {
    const values = templateData(input, version, placeholders, {
      fields: current.fields,
      referenceDate: '2026-11-21',
    });
    const xml = new PizZip(generateDocument(templateBytes(version), values))
      .file('word/document.xml')
      ?.asText();
    if (!xml) throw new Error('Missing rendered Word document');
    const paragraphs = [...xml.matchAll(/<w:p(?: [^>]*)?>.*?<\/w:p>/gs)].map(
      ([paragraph]) => paragraph,
    );
    const ending = (text: string) =>
      paragraphs.find((paragraph) => paragraph.includes(text));
    const signature = paragraphs.find((paragraph) =>
      /_{20,}\s+\S/u.test(paragraph.replace(/<[^>]+>/gu, '')),
    );
    expect(signature).toContain('<w:keepLines');
    if (id === 'creditors') {
      const tables = [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/gs)];
      expect(tables).toHaveLength(9);
      const repeatCounts = [1, 4, 2, 4, 2, 4, 3, 4, 3];
      for (const [index, count] of repeatCounts.entries()) {
        const table = tables[index]?.[0];
        if (!table) throw new Error('Missing rendered creditor table');
        const rows = [...table.matchAll(/<w:tr(?: [^>]*)?>(.*?)<\/w:tr>/gs)];
        expect(
          rows.slice(0, count).every(([row]) => row.includes('<w:tblHeader')),
        ).toBe(true);
        expect(
          rows.slice(count).some(([row]) => row.includes('<w:tblHeader')),
        ).toBe(false);
        expect(rows.every(([row]) => row.includes('<w:cantSplit'))).toBe(true);
        expect(table).toContain('<w:tblW w:w="9355" w:type="dxa"');
        expect(table).toContain('<w:tblInd w:w="0" w:type="dxa"');
      }
    }
    if (id === 'statement') {
      expect(ending('Приложения:')).toContain('<w:keepNext');
      expect(ending('Первый документ')).not.toContain('<w:keepNext');
      expect(ending('Последний документ')).toContain('<w:keepNext');
      const blank = templateData(emptyFieldValues(), version, placeholders);
      expect(
        new PizZip(generateDocument(templateBytes(version), blank))
          .file('word/document.xml')
          ?.asText(),
      ).not.toContain('Приложения:');
    } else {
      expect(ending('Достоверность и полноту')).toContain('<w:keepNext');
    }
  }
});

test('the revised statement uses lowercase passport label and terminates each attachment entry', () => {
  const pack = requirePackage('bfl-bankruptcy-v12');
  const statement = pack.documents.find(({ id }) => id === 'statement');
  if (!statement) throw new Error('Missing statement');
  expect(statement.version).toBe('bfl-statement-v11');

  const values = {
    ...emptyFieldValues(),
    documentNumber: '00 00 № 000000',
    submittedAttachments: [
      {
        documentId: 'package:creditors',
        description: 'Список кредиторов и должников',
        category: 'other',
        copyKind: 'paperOriginal',
      },
      {
        documentId: 'source-copy',
        description: 'Копия паспорта',
        category: 'other',
        copyKind: 'copy',
      },
    ],
  };
  const rendered = generateDocument(
    templateBytes(statement.version),
    templateData(values, statement.version, statement.placeholders),
  );
  const xml = new PizZip(rendered).file('word/document.xml')?.asText();
  expect(xml).toContain('паспорт: 00 00 № 000000');
  expect(xml).not.toContain('Паспорт:');
  expect(xml).toContain('Список кредиторов и должников (оригинал);');
  expect(xml).toContain('Копия паспорта (копия);');
  expect(xml).toContain('Список своих кредиторов и должников');
  expect(xml).toContain(
    'Как видно из приведенного выше, общий (совокупный) размер моих обязательств превышает общую стоимость имущества.',
  );
});
