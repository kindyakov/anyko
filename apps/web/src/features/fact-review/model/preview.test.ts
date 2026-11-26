import { expect, test } from 'bun:test';

import type { DocumentPackage } from '@anyko/contracts/catalog';

import { mentions } from './preview';

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
