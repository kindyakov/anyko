import type Docxtemplater from 'docxtemplater';

function attribute(xml: string, name: string) {
  return new RegExp(`\\bw:${name}=(["'])(.*?)\\1`, 'u').exec(xml)?.[2];
}

function positive(value: string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function fontSize(xml: string) {
  return positive(attribute(/<w:sz\b[^>]*>/u.exec(xml)?.[0] ?? '', 'val'));
}

function paragraphFonts(styles: string) {
  const fonts = new Map<
    string,
    { size: number | undefined; base: string | undefined }
  >();
  let normal: string | undefined;
  for (const [, attributes = '', body = ''] of styles.matchAll(
    /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/gu,
  )) {
    const id = attribute(attributes, 'styleId');
    if (!id || attribute(attributes, 'type') !== 'paragraph') continue;
    fonts.set(id, {
      size: fontSize(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/u.exec(body)?.[0] ?? ''),
      base: attribute(/<w:basedOn\b[^>]*>/u.exec(body)?.[0] ?? '', 'val'),
    });
    if (attribute(attributes, 'default') === '1') normal = id;
  }
  const fallback =
    fontSize(
      /<w:docDefaults\b[^>]*>[\s\S]*?<\/w:docDefaults>/u.exec(styles)?.[0] ??
        '',
    ) ?? 24;
  return (style: string | undefined) => {
    const visited = new Set<string>();
    for (let id = style ?? normal; id && !visited.has(id);) {
      visited.add(id);
      const font = fonts.get(id);
      if (font?.size) return font.size;
      id = font?.base;
    }
    return fallback;
  };
}

type Cell = {
  width?: number | undefined;
  span: number;
  padding?: number | undefined;
};
type Table = {
  grid: number[];
  column: number;
  rowCells: number;
  width?: number | undefined;
  padding: number;
  cell?: Cell | undefined;
};

function padding(xml: string) {
  const margins =
    /<w:(?:tcMar|tblCellMar)\b[^>]*>([\s\S]*?)<\/w:(?:tcMar|tblCellMar)>/u.exec(
      xml,
    )?.[1];
  if (!margins) return undefined;
  const side = (pattern: RegExp) =>
    Number(attribute(pattern.exec(margins)?.[0] ?? '', 'w') ?? 108);
  return side(/<w:(?:start|left)\b[^>]*>/u) + side(/<w:(?:end|right)\b[^>]*>/u);
}

type Part = Docxtemplater.DXT.Part;

function rowCellCounts(parts: Part[]) {
  const counts = new Map<Part, number>();
  const rows: Part[] = [];
  for (const part of parts) {
    if (part.tag === 'w:tr' && part.position === 'start') rows.push(part);
    if (part.tag === 'w:tr' && part.position === 'end') rows.pop();
    const row = rows.at(-1);
    if (row && part.tag === 'w:tc' && part.position === 'start')
      counts.set(row, (counts.get(row) ?? 0) + 1);
  }
  return counts;
}

export function cellLines(parts: Part[], styles: string, maximum: number) {
  const paragraphFont = paragraphFonts(styles);
  const rowCounts = rowCellCounts(parts);
  const tables: Table[] = [];
  let style: string | undefined;
  let paragraphSize: number | undefined;
  let runSize: number | undefined;
  let inRun = false;
  let indent = 0;
  return {
    observe(part: Part) {
      if (part.tag === 'w:tbl' && part.position === 'start')
        tables.push({ grid: [], column: 0, rowCells: 1, padding: 216 });
      if (part.tag === 'w:tbl' && part.position === 'end') tables.pop();
      const table = tables.at(-1);
      if (!table) return;
      if (part.tag === 'w:tr' && part.position === 'start') {
        table.column = 0;
        table.rowCells = rowCounts.get(part) ?? 1;
      }
      if (part.tag === 'w:tc' && part.position === 'start')
        table.cell = { span: 1 };
      if (part.tag === 'w:tc' && part.position === 'end') {
        table.column += table.cell?.span ?? 1;
        table.cell = undefined;
      }
      if (part.tag === 'w:p' && part.position === 'start') {
        style = undefined;
        paragraphSize = undefined;
        indent = 0;
      }
      if (part.tag === 'w:r') {
        inRun = part.position === 'start';
        runSize = undefined;
      }
      if (part.type !== 'content' || part.position !== 'outsidetag') return;
      const xml = part.value;
      const { cell } = table;
      if (!cell) {
        for (const [column] of xml.matchAll(/<w:gridCol\b[^>]*>/gu))
          table.grid.push(positive(attribute(column, 'w')) ?? 0);
        const width = /<w:tblW\b[^>]*>/u.exec(xml)?.[0];
        if (width && attribute(width, 'type') === 'dxa')
          table.width = positive(attribute(width, 'w'));
        const before = /<w:gridBefore\b[^>]*>/u.exec(xml)?.[0];
        if (before) table.column = positive(attribute(before, 'val')) ?? 0;
        table.padding = padding(xml) ?? table.padding;
        return;
      }
      const width = /<w:tcW\b[^>]*>/u.exec(xml)?.[0];
      if (width && attribute(width, 'type') === 'dxa')
        cell.width = positive(attribute(width, 'w'));
      const span = /<w:gridSpan\b[^>]*>/u.exec(xml)?.[0];
      if (span) cell.span = positive(attribute(span, 'val')) ?? 1;
      cell.padding = padding(xml) ?? cell.padding;
      const pStyle = /<w:pStyle\b[^>]*>/u.exec(xml)?.[0];
      if (pStyle) style = attribute(pStyle, 'val');
      const size = fontSize(xml);
      if (inRun) runSize = size ?? runSize;
      else paragraphSize = size ?? paragraphSize;
      const ind = /<w:ind\b[^>]*>/u.exec(xml)?.[0];
      if (ind)
        indent = ['left', 'right', 'start', 'end', 'firstLine'].reduce(
          (total, side) => total + (positive(attribute(ind, side)) ?? 0),
          0,
        );
    },
    length() {
      const table = tables.at(-1);
      const cell = table?.cell;
      if (!table || !cell) return maximum;
      const columns = table.grid.slice(table.column, table.column + cell.span);
      const gridWidth =
        columns.length === cell.span && columns.every(Boolean)
          ? columns.reduce((sum, width) => sum + width, 0)
          : undefined;
      // A proportional estimate when Word leaves both the cell and grid widths automatic.
      const width =
        cell.width ??
        gridWidth ??
        ((table.width ?? 9360) * cell.span) /
          (table.grid.length || table.rowCells);
      // The form font uses a half-em underscore. Leave room for font substitution.
      const advance =
        (runSize ?? paragraphSize ?? paragraphFont(style)) * 5 * 1.08;
      const usable = width - (cell.padding ?? table.padding) - indent;
      return Math.max(1, Math.min(maximum, Math.floor(usable / advance)));
    },
  };
}
