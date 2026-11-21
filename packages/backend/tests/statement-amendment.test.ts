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

test('the revised statement uses lowercase passport label and terminates each attachment entry', () => {
  const pack = availablePackages()[0];
  expect(pack?.version).toBe('bfl-bankruptcy-v12');
  const statement = pack?.documents.find(({ id }) => id === 'statement');
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
  expect(xml).not.toContain('в прилагаемой описи');
});
