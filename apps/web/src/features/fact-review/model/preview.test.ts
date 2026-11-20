import { expect, test } from 'bun:test';

import type { DocumentPackage, PreviewRow } from '@anyko/contracts/catalog';

import { mentions, previewEntries } from './preview';

test('collects paragraph and table text and includes repeated row keys', () => {
  const blocks = [
    { kind: 'paragraph', paragraph: { text: 'Hello {name}' } },
    {
      kind: 'table',
      rows: [
        {
          repeat: 'creditors',
          cells: [{ paragraphs: [{ text: '{amount}' }, { text: 'end' }] }],
        },
        { repeat: null, cells: [{ paragraphs: [{ text: 'ordinary' }] }] },
      ],
    },
  ] as DocumentPackage['documents'][number]['blocks'];
  expect(mentions(blocks)).toBe(
    'Hello {name} {#creditors} {amount} end  ordinary',
  );
  expect(mentions([])).toBe('');
});

test('uses supplied rows, or builds an empty row from placeholders when unknown', () => {
  const row = {
    repeat: 'creditors',
    cells: [{ paragraphs: [{ text: '{name} {amount} {#ignored}' }] }],
  } as PreviewRow;
  expect(previewEntries(row, null)).toEqual([{ name: null, amount: null }]);
  expect(previewEntries(row, [])).toEqual([]);
  expect(previewEntries(row, [{ name: 'A' }])).toEqual([{ name: 'A' }]);
});
