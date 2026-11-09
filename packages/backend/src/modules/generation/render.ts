import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { FieldValues } from '@anyko/contracts';

export function generateDocument(
  source: Uint8Array,
  values: FieldValues,
): Uint8Array {
  const document = new Docxtemplater(new PizZip(source), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  document.render(
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value ?? '']),
    ),
  );
  return document
    .getZip()
    .generate({ type: 'uint8array', compression: 'DEFLATE' });
}
