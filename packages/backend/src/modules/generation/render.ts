import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import { missingTemplateValue } from '@anyko/document-values/template-value';
import type { LogEvent, Logger } from '@anyko/logger';

import type { FieldValues } from '../../profiles/bfl/fields';

import { cellLines } from './cell-line';

const inlineLine = '_'.repeat(14);
const paragraphLine = '_'.repeat(72);
type RenderLog = {
  logger: Pick<Logger, 'warn'>;
  templateVersion: string;
  jobId?: LogEvent['jobId'];
  correlationId?: LogEvent['correlationId'];
};
const technicalValues = new Set([
  'undefined',
  'null',
  'NaN',
  '[object Object]',
]);

function blankSlots(styles: string, log: RenderLog | undefined) {
  // The parsed tag identifies an occurrence, including tags split across Word runs.
  const standalone = new WeakMap<Docxtemplater.DXT.Part, string>();
  const warned = new Set<string>();
  const line = (part: Docxtemplater.DXT.Part) =>
    standalone.get(part) ?? inlineLine;
  const technical = (part: Docxtemplater.DXT.Part) => {
    if (log && !warned.has(part.value)) {
      warned.add(part.value);
      log.logger.warn({
        event: 'template_technical_value',
        errorCode: 'TEMPLATE_TECHNICAL_VALUE',
        field: part.value,
        templateVersion: log.templateVersion,
        jobId: log.jobId,
        correlationId: log.correlationId,
      });
    }
    return line(part);
  };
  const module: Docxtemplater.DXT.Module = {
    // Inspect the source grid before Docxtemplater splits its loop rows.
    priority: 10,
    postparse(parts) {
      const cells = cellLines(parts, styles, paragraphLine.length);
      let contents: Docxtemplater.DXT.Part[] = [];
      let length = paragraphLine.length;
      for (const part of parts) {
        cells.observe(part);
        if (part.type === 'placeholder' && !part.module)
          length = cells.length();
        if (part.tag === 'w:p' && part.position === 'start') contents = [];
        if (part.tag === 'w:p' && part.position === 'end') {
          const [only] = contents;
          if (
            contents.length === 1 &&
            only?.type === 'placeholder' &&
            !only.module &&
            !standalone.has(only)
          )
            standalone.set(only, '_'.repeat(length));
        }
        if (
          (part.type === 'placeholder' && part.module !== 'loop') ||
          (part.type === 'content' &&
            (part.position === 'insidetag'
              ? part.value.trim()
              : /<w:(?:br|tab|drawing|pict|object|sym)\b/u.test(part.value)))
        )
          contents.push(part);
      }
      return parts;
    },
  };
  const parser: NonNullable<Docxtemplater.DXT.Options['parser']> = (tag) => ({
    get(scope: unknown, { meta: { part } }) {
      const record =
        scope && typeof scope === 'object' && Object.hasOwn(scope, tag)
          ? (scope as Record<string, unknown>)
          : undefined;
      if (tag !== '.' && !record) return undefined;
      const value = tag === '.' ? scope : record?.[tag];
      if (part.module) return value;
      if (typeof value === 'string') {
        const text = value.trim();
        if (text === missingTemplateValue) return line(part);
        if (
          technicalValues.has(text) ||
          /^\{[#/@^]?[\p{L}_][\p{L}\p{N}_.]*\}$/u.test(text)
        )
          return technical(part);
        return value.replaceAll(missingTemplateValue, inlineLine);
      }
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : technical(part);
    },
  });
  const nullGetter = (part: Docxtemplater.DXT.Part) =>
    part.module ? '' : technical(part);
  return { modules: [module], parser, nullGetter };
}

export function generateDocument(
  source: Uint8Array,
  values: FieldValues,
  log?: RenderLog,
): Uint8Array {
  const zip = new PizZip(source);
  const document = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    ...blankSlots(zip.file('word/styles.xml')?.asText() ?? '', log),
  });
  document.render(values);
  return document
    .getZip()
    .generate({ type: 'uint8array', compression: 'DEFLATE' });
}
