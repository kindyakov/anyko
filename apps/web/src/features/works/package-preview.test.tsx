import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  documentPackageSchema,
  emptyFieldValues,
  fieldDefinitions,
} from '@anyko/contracts';
import { PackagePreview } from './package-preview';

const paragraph = (text: string) => ({
  text,
  align: 'left',
  bold: false,
  fontSize: 12,
  indent: 0,
  after: 0,
});
const pack = documentPackageSchema.parse({
  id: 'fixture',
  version: 'fixture-v1',
  title: 'Пакет',
  technical: false,
  fields: fieldDefinitions.filter((field) =>
    ['lastName', 'debts', 'businessDebts'].includes(field.key),
  ),
  documents: ['Заявление', 'Опись', 'Кредиторы'].map((title, index) => ({
    id: String(index),
    version: `fixture-${String(index)}`,
    title,
    filename: `${String(index)}.docx`,
    checksum: '0'.repeat(64),
    blocks: [
      {
        kind: 'table',
        widths: [1, 1],
        rows: [
          {
            repeat: null,
            cells: [
              {
                span: 1,
                merge: 'none',
                paragraphs: [paragraph('Должник: {lastName}')],
              },
              {
                span: 1,
                merge: 'none',
                paragraphs: [
                  paragraph('{#debts}{name}{/debts}'),
                  paragraph('{#businessDebts}{name}{/businessDebts}'),
                ],
              },
            ],
          },
        ],
      },
    ],
  })),
});

test('package preview exposes all documents and renders nested creditor loops once each without leaking service tags', () => {
  const html = renderToStaticMarkup(
    <PackagePreview
      pack={pack}
      values={{
        ...emptyFieldValues(),
        lastName: '<script>sample</script>',
        debts: [{ name: 'Личный кредитор' }],
        businessDebts: [{ name: 'Предпринимательский кредитор' }],
      }}
      disabled={false}
      onChange={() => undefined}
    />,
  );
  const paper = html.slice(
    html.indexOf('<article'),
    html.indexOf('</article>'),
  );
  expect((html.match(/role="tab"/g) ?? []).length).toBe(3);
  expect((paper.match(/Личный кредитор/g) ?? []).length).toBe(1);
  expect((paper.match(/Предпринимательский кредитор/g) ?? []).length).toBe(1);
  expect(paper).not.toMatch(/\{[#/][a-zA-Z]+\}/);
  expect(paper).not.toContain('<script>');
  expect(paper).toContain('&lt;script&gt;');
});
