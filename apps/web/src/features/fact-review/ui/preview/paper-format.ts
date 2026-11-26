import type { CSSProperties } from 'react';

import type {
  DocumentTemplate,
  PreviewParagraph,
} from '@anyko/contracts/catalog';

export function paperMargins(
  margins: DocumentTemplate['margins'],
): CSSProperties | undefined {
  return (
    margins && {
      paddingTop: `${String(margins.top)}pt`,
      paddingRight: `${String(margins.right)}pt`,
      paddingBottom: `${String(margins.bottom)}pt`,
      paddingLeft: `${String(margins.left)}pt`,
    }
  );
}

export function paragraphStyle(
  p: PreviewParagraph,
  hasMargins: boolean,
  markerBesideField: boolean,
): CSSProperties {
  return {
    textAlign: p.align,
    fontWeight: p.bold ? 'bold' : 'normal',
    fontStyle: p.italic ? 'italic' : undefined,
    textDecoration: p.underline ? 'underline' : undefined,
    fontSize: `${String(p.fontSize)}pt`,
    textIndent: markerBesideField ? 0 : `${String(p.indent)}pt`,
    marginLeft: `${String((p.left ?? 0) + (markerBesideField ? p.indent : 0))}pt`,
    marginRight: `${String(p.right ?? 0)}pt`,
    marginBottom: `${String(hasMargins ? p.after : Math.max(3, p.after))}pt`,
  };
}
