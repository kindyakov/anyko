import type { DocumentPackage } from '@anyko/contracts/catalog';

export function mentions(
  blocks: DocumentPackage['documents'][number]['blocks'],
) {
  const text = blocks
    .flatMap((block) =>
      block.kind === 'paragraph'
        ? [block.paragraph.text]
        : block.rows.flatMap((row) => [
            row.repeat ? `{#${row.repeat}}` : '',
            ...row.cells.flatMap((cell) => cell.paragraphs.map((p) => p.text)),
          ]),
    )
    .join(' ');
  return text;
}
