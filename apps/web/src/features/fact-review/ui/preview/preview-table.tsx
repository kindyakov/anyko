import type { ReactNode } from 'react';

import type { DocumentTemplate, PreviewRow } from '@anyko/contracts/catalog';

type TableBlock = Extract<
  DocumentTemplate['blocks'][number],
  { kind: 'table' }
>;

export function PreviewTable({
  block,
  hasMargins,
  renderRow,
}: {
  block: TableBlock;
  hasMargins: boolean;
  renderRow: (row: PreviewRow, index: number) => ReactNode;
}) {
  const total = Math.max(
    1,
    block.widths.reduce((sum, width) => sum + width, 0),
  );
  return (
    <table
      className={`w-full table-fixed border-collapse [&_td]:wrap-anywhere ${hasMargins ? '[&_td]:px-[5.4pt]' : 'my-3 [&_td]:p-1'} ${block.bordered ? '[&_td]:border [&_td]:border-zinc-600' : ''}`}
    >
      <colgroup>
        {block.widths.map((width, column) => (
          <col
            key={column}
            style={{ width: `${String((width / total) * 100)}%` }}
          />
        ))}
      </colgroup>
      <tbody>{block.rows.map(renderRow)}</tbody>
    </table>
  );
}
