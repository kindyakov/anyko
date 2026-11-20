import type {
  DocumentPackage,
  FieldValue,
  PreviewRow,
} from '@anyko/contracts/catalog';

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

export function previewEntries(
  row: PreviewRow,
  collection: FieldValue | undefined,
) {
  return row.repeat
    ? Array.isArray(collection)
      ? collection
      : [
          Object.fromEntries(
            row.cells.flatMap((cell) =>
              cell.paragraphs.flatMap((p) =>
                [...p.text.matchAll(/\{([^{}#/]+)\}/g)].map((m) => [
                  m[1] ?? '',
                  null,
                ]),
              ),
            ),
          ),
        ]
    : [undefined];
}
