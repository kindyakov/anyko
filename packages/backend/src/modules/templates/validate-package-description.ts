import { createHash } from 'node:crypto';

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { z } from 'zod';

import { attachmentCategory } from '@anyko/document-values/attachments';
import { prepareTemplate } from '@anyko/document-values/template-filling';

import { validateAnalysisPlan } from '../../profiles/analysis-plan';
import type { PackagePublication } from '../../profiles/package-description';
import { documentPackageSchema } from '../../profiles/template-schema';

const nonempty = z.string().trim().min(1);
const publicationSchema = z.strictObject({
  profile: z.strictObject({ id: nonempty, revision: nonempty }),
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

export function validatePackageDescription(
  description: PackagePublication,
  readBytes: (version: string) => Uint8Array,
) {
  const { package: pack, analysis, requirements, catalogTitles } = description;
  const parsed = publicationSchema.parse(description);
  if (canonicalJson(description) !== canonicalJson(parsed))
    throw new Error('Invalid package description');
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
    const prepared = prepareTemplate(
      { ...document, fields: pack.fields, attachments },
      {},
      {
        referenceDate: '2026-01-01',
      },
    );
    const computedRows = new Set(prepared.computedRepeats);
    const declared = new Set(placeholders.map(({ tag }) => tag));
    for (const [tag, shape] of bindings) {
      if (
        (shape === 'loop' && !Object.hasOwn(prepared.repeating, tag)) ||
        (shape === 'scalar' && !Object.hasOwn(prepared.scalars, tag))
      )
        throw new Error(`Invalid DOCX tag type ${tag} in ${version}`);
      if (!declared.has(tag) && !(shape === 'loop' && computedRows.has(tag)))
        throw new Error(`Undeclared DOCX tag ${tag} in ${version}`);
    }
    for (const { tag, field, placeholder } of placeholders) {
      const [key = '', column] = field.split('.');
      const definition = fields.get(key);
      let valid: boolean;
      if (placeholder !== 'identity') {
        const valueType =
          definition?.valueType ??
          (key === 'debtTotal' && filling ? 'money' : undefined);
        valid =
          valueType === (placeholder.startsWith('RUB_') ? 'money' : 'date');
      } else if (column) {
        const row = prepared.repeating[key]?.[0];
        valid =
          (row !== undefined && Object.hasOwn(row, column)) ||
          definition?.columns.some(({ key }) => key === column) === true ||
          (computedRows.has(key) &&
            ((key === 'creditorHeaders' &&
              ['name', 'inn', 'ogrn', 'address'].includes(column)) ||
              (['attachments', 'attachmentTail', 'statementDebts'].includes(
                key,
              ) &&
                column === 'description')));
      } else {
        valid =
          Object.hasOwn(prepared.scalars, key) ||
          Object.hasOwn(prepared.repeating, key);
      }
      if (!valid || field.split('.').length > 2)
        throw new Error(`Invalid DOCX binding ${tag} in ${version}`);
    }
  }
  return contentHash(description);
}
