import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import { generateDocument } from '../src/modules/generation';
import {
  availablePackages,
  requirePackage,
  templateBytes,
  templateData,
} from '../src/modules/templates';
import { emptyFieldValues } from '../src/profiles/bfl/fields';

test('the cadastral field is enabled only for new-package facts and inventory', () => {
  const archived = requirePackage('bfl-bankruptcy-v12');
  const current = availablePackages()[0];
  expect(current?.version).toBe('bfl-bankruptcy-v13');
  if (!current) throw new Error('Missing current package');
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

test('the revised statement uses lowercase passport label and terminates each attachment entry', () => {
  const pack = requirePackage('bfl-bankruptcy-v12');
  const statement = pack.documents.find(({ id }) => id === 'statement');
  if (!statement) throw new Error('Missing statement');
  expect(statement.version).toBe('bfl-statement-v11');
  const archived = requirePackage('bfl-bankruptcy-v11');
  expect(archived.documents[0]?.version).toBe('bfl-statement-v10');

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
