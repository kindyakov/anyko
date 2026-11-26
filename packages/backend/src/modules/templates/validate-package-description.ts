import { createHash } from 'node:crypto';

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { z } from 'zod';

import { attachmentCategory } from '@anyko/document-values/attachments';
import { templateFillingOutputs } from '@anyko/document-values/template-filling';

import { validateAnalysisPlan } from '../../profiles/analysis-plan';
import type { PackagePublication } from '../../profiles/package-description';
import { documentPackageSchema } from '../../profiles/template-schema';
import type { DocumentPackage } from '../../profiles/template-schema';

const nonempty = z.string().trim().min(1);
const publicationSchema = z.strictObject({
  profile: z.strictObject({ id: nonempty, revision: nonempty }),
  scope: z.enum(['production', 'retained', 'internal']).optional(),
  package: documentPackageSchema,
  catalogTitles: z
    .strictObject({
      package: nonempty,
      templates: z.record(nonempty, nonempty),
    })
    .optional(),
  requirements: z.record(
    nonempty,
    z.array(
      z.strictObject({
        key: nonempty,
        documentKind: nonempty,
        label: nonempty,
        applicability: z.enum(['usual', 'conditional']),
        position: z.number().int().nonnegative(),
      }),
    ),
  ),
  analysis: z.strictObject({
    excludedFields: z.array(nonempty),
    plan: z
      .strictObject({
        revision: nonempty,
        steps: z.array(
          z.strictObject({
            key: nonempty,
            title: nonempty,
            kind: z.enum(['collect', 'review']),
            fields: z.array(nonempty),
            instructions: z.string(),
          }),
        ),
      })
      .optional(),
    instructions: z
      .strictObject({
        extraction: z.string(),
        reconciliation: z.string(),
        reconciliationWithChecklist: z.string(),
        chat: z.string(),
      })
      .optional(),
  }),
});

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item))
      return item;
    return Object.fromEntries(
      Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
}

export function contentHash(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function parsePackagePublication(input: unknown): PackagePublication {
  const parsed = publicationSchema.parse(input);
  if (canonicalJson(input) !== canonicalJson(parsed))
    throw new Error('Invalid package description');
  return parsed;
}

function unique(keys: readonly (string | number)[], source: string) {
  if (new Set(keys).size !== keys.length)
    throw new Error(`Duplicate key in ${source}`);
}

function docxBindings(bytes: Uint8Array) {
  const tags = new Map<string, 'scalar' | 'loop' | 'cell'>();
  const add = (tag: string, kind: 'scalar' | 'loop' | 'cell') => {
    if (tags.has(tag) && tags.get(tag) !== kind)
      throw new Error(`Conflicting DOCX tag shape ${tag}`);
    tags.set(tag, kind);
  };
  const inspect: Docxtemplater.DXT.Module = {
    priority: 10,
    postparse(parts, options) {
      // Docxtemplater calls postparse again for the interior of each loop.
      // Its type declaration omits the options object passed at runtime.
      if ('basePart' in options) return parts;
      let row = 0;
      let nextRow = 0;
      let loop: { key: string; row: number; cells: number } | undefined;
      for (const part of parts) {
        if (part.tag === 'w:tr' && part.position === 'start') row = ++nextRow;
        if (part.tag === 'w:tr' && part.position === 'end') row = 0;
        if (part.type !== 'placeholder') continue;
        const key = part.value;
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/u.test(key))
          throw new Error(`Invalid DOCX tag ${key}`);
        if (part.module === 'loop') {
          const { location, inverted } = part as typeof part & {
            location: 'start' | 'end';
            inverted?: boolean;
          };
          if (location === 'start' && !loop && !inverted) {
            loop = { key, row, cells: 0 };
            add(key, 'loop');
          } else if (
            location === 'end' &&
            loop?.key === key &&
            loop.row === row &&
            loop.cells
          ) {
            loop = undefined;
          } else {
            throw new Error(`Invalid DOCX loop ${key}`);
          }
        } else if (part.module) {
          throw new Error(`Unsupported DOCX tag ${key}`);
        } else if (loop) {
          loop.cells++;
          add(`${loop.key}.${key}`, 'cell');
        } else {
          add(key, 'scalar');
        }
      }
      if (loop) throw new Error(`Invalid DOCX loop ${loop.key}`);
      return parts;
    },
  };
  new Docxtemplater(new PizZip(bytes), {
    paragraphLoop: true,
    errorLogging: false,
    modules: [inspect],
  });
  return tags;
}

function validatePreview(
  document: DocumentPackage['documents'][number],
  technical: boolean,
  scalars: ReadonlySet<string>,
  repeats: ReadonlyMap<string, readonly string[]>,
  bindings: ReturnType<typeof docxBindings>,
) {
  const preview = { hasContent: false, hasDocxValue: false };
  const repeater = (key: string) => {
    const columns = repeats.get(key);
    if (!columns)
      throw new Error(`Invalid preview repeater ${key} in ${document.version}`);
    return { key, columns };
  };
  const paragraph = (text: string, row?: ReturnType<typeof repeater>) => {
    const markers = [...text.matchAll(/\{([#/])([^{}]+)\}/gu)];
    if (markers.length) {
      const [start, end] = markers;
      if (
        row ||
        markers.length !== 2 ||
        start?.[1] !== '#' ||
        end?.[1] !== '/' ||
        start[2] !== end[2] ||
        !start[2]
      )
        throw new Error(`Invalid preview loop in ${document.version}`);
      row = repeater(start[2]);
    }
    for (const [, key = ''] of text.matchAll(/\{([^{}#/]+)\}/gu)) {
      if (!(row ? row.columns.includes(key) : scalars.has(key)))
        throw new Error(`Invalid preview slot ${key} in ${document.version}`);
      if (
        row
          ? bindings.get(`${row.key}.${key}`) === 'cell'
          : bindings.get(key) === 'scalar'
      )
        preview.hasDocxValue = true;
    }
    if (text.replace(/\{[#/][^{}]+\}/gu, '').trim()) preview.hasContent = true;
  };
  for (const block of document.blocks) {
    if (block.kind === 'paragraph') {
      paragraph(block.paragraph.text);
      continue;
    }
    for (const row of block.rows) {
      const repeat = row.repeat === null ? undefined : repeater(row.repeat);
      for (const cell of row.cells)
        for (const item of cell.paragraphs)
          if (cell.merge !== 'continue') paragraph(item.text, repeat);
    }
  }
  if (!technical && !preview.hasContent)
    throw new Error(`Missing preview in ${document.version}`);
  if (!technical && bindings.size > 0 && !preview.hasDocxValue)
    throw new Error(
      `Preview has no DOCX value references in ${document.version}`,
    );
}

export function validatePackageDescription(
  description: PackagePublication,
  readBytes: (version: string) => Uint8Array,
) {
  const { package: pack, analysis, requirements, catalogTitles } = description;
  parsePackagePublication(description);
  unique(
    pack.fields.map(({ key }) => key),
    'package fields',
  );
  unique(
    pack.documents.map(({ id }) => id),
    'template IDs',
  );
  unique(
    pack.documents.map(({ version }) => version),
    'template versions',
  );
  const attachments = pack.attachments ?? [];
  unique(
    attachments.map(({ documentId }) => documentId),
    'attachments',
  );
  if (attachments.some(({ category }) => !attachmentCategory(category)))
    throw new Error('Invalid package attachment category');
  const fields = new Map(pack.fields.map((field) => [field.key, field]));
  if (
    pack.defaultDocumentDate &&
    fields.get('documentDate')?.valueType !== 'date'
  )
    throw new Error('A default document date requires a date field');
  if (attachments.length && fields.get('submittedAttachments')?.kind !== 'rows')
    throw new Error('Package attachments require a repeating field');
  for (const field of fields.values()) {
    unique(
      field.columns.map(({ key }) => key),
      field.key,
    );
    if (
      (field.kind === 'rows') !== Boolean(field.columns.length) ||
      (field.kind === 'rows' && field.valueType)
    )
      throw new Error(`Invalid field shape ${field.key}`);
  }
  unique(analysis.excludedFields, 'excluded analysis fields');
  if (analysis.excludedFields.some((key) => !fields.has(key)))
    throw new Error('Unknown excluded analysis field');
  if (analysis.plan) {
    // The profile may reserve fields for manual input in its ordered plan.
    const plannedFields = analysis.plan.steps.flatMap(({ fields }) => fields);
    if (
      plannedFields.some(
        (key) => !fields.has(key) || analysis.excludedFields.includes(key),
      )
    )
      throw new Error('Unknown analysis step field');
    validateAnalysisPlan(analysis.plan, plannedFields);
  }
  const versions = new Set(pack.documents.map(({ version }) => version));
  if (
    [
      ...Object.keys(requirements),
      ...Object.keys(catalogTitles?.templates ?? {}),
    ].some((version) => !versions.has(version))
  )
    throw new Error('Unknown requirement template');
  const matchedRequirements = new Map<string, string>();
  for (const document of pack.documents) {
    const { version, placeholders = [], filling } = document;
    const sourceRequirements = requirements[version] ?? [];
    unique(
      sourceRequirements.map(({ key }) => key),
      version + ' requirements',
    );
    unique(
      sourceRequirements.map(({ position }) => position),
      version + ' requirement positions',
    );
    for (const {
      key,
      documentKind,
      label,
      applicability,
    } of sourceRequirements) {
      const content = canonicalJson({ documentKind, label, applicability });
      const matched = matchedRequirements.get(key);
      if (matched !== undefined && matched !== content)
        throw new Error(`Conflicting source requirement ${key}`);
      matchedRequirements.set(key, content);
    }

    const bytes = readBytes(version);
    if (createHash('sha256').update(bytes).digest('hex') !== document.checksum)
      throw new Error(`DOCX checksum mismatch in ${version}`);
    const bindings = docxBindings(bytes);
    unique(
      placeholders.map(({ tag }) => tag),
      version + ' placeholders',
    );
    const computed = templateFillingOutputs(filling, pack.fields);
    const scalars = new Set(computed?.scalars);
    const repeats = new Map(computed?.repeats);
    for (const { key, columns } of fields.values()) {
      if (
        scalars.has(key) ||
        (repeats.has(key) && !computed?.ownFields.has(key))
      )
        throw new Error(`Output collides with field ${key} in ${version}`);
      if (!columns.length) scalars.add(key);
      else if (!repeats.has(key))
        repeats.set(
          key,
          computed?.sourceRowColumns({ key, columns }) ??
            columns.map((column) => column.key),
        );
    }
    const declared = new Set(placeholders.map(({ tag }) => tag));
    for (const { tag, field, placeholder } of placeholders) {
      const [key = '', column, ...rest] = field.split('.');
      const definition = fields.get(key);
      let valid: boolean;
      if (placeholder !== 'identity') {
        const builtIn = computed?.builtInFormats.get(tag);
        valid =
          computed?.scalars.has(key) || computed?.scalars.has(tag)
            ? builtIn?.field === field && builtIn.placeholder === placeholder
            : !repeats.has(tag) &&
              definition?.valueType ===
                (placeholder.startsWith('RUB_') ? 'money' : 'date');
        if (valid) {
          if (fields.has(tag) && (tag !== field || definition?.kind !== 'text'))
            throw new Error(`Output collides with field ${tag} in ${version}`);
          scalars.add(tag);
        }
      } else if (column) {
        valid = repeats.get(key)?.includes(column) === true;
      } else {
        valid = scalars.has(key) || repeats.has(key);
      }
      if (!valid || rest.length)
        throw new Error(`Invalid DOCX binding ${tag} in ${version}`);
    }
    for (const [tag, shape] of bindings) {
      const [key = '', column = ''] = tag.split('.');
      const valid =
        shape === 'loop'
          ? repeats.has(tag)
          : shape === 'scalar'
            ? scalars.has(tag)
            : repeats.get(key)?.includes(column);
      if (!valid) throw new Error(`Invalid DOCX tag type ${tag} in ${version}`);
      if (
        !declared.has(tag) &&
        !(shape === 'loop' && computed?.repeats.has(tag))
      )
        throw new Error(`Undeclared DOCX tag ${tag} in ${version}`);
    }
    validatePreview(document, pack.technical, scalars, repeats, bindings);
  }
  return contentHash(description);
}
