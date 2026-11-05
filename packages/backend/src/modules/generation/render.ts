import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { fieldValuesSchema, type FieldValues } from '@anyko/contracts';

export function generateDocument(
  source: Uint8Array,
  values: FieldValues,
): Uint8Array {
  const parsed = fieldValuesSchema.parse(values);
  const document = new Docxtemplater(new PizZip(source), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  document.render(
    Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, value ?? '']),
    ),
  );
  return document
    .getZip()
    .generate({ type: 'uint8array', compression: 'DEFLATE' });
}
