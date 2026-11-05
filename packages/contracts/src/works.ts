import { z } from 'zod';
import { documentSchema } from './documents';
import {
  fieldKeySchema,
  fieldValuesSchema,
  fieldValueSchema,
  fieldValueIssue,
  readFieldValues,
} from './work-fields';
import {
  documentPackageSchema,
  generationFileSchema,
} from './document-packages';
export * from './work-fields';
export * from './document-packages';

export const evidenceSchema = z
  .object({
    documentId: z.uuid(),
    imagePath: z.string().max(240).nullable(),
    quote: z.string().max(2000),
  })
  .strict();
export const candidateSchema = z
  .object({
    field: fieldKeySchema,
    value: fieldValueSchema.refine(
      (value) =>
        value !== null &&
        (typeof value !== 'string' || value.trim().length > 0),
    ),
    evidence: z.array(evidenceSchema).min(1).max(12),
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = fieldValueIssue(value.field, value.value);
    if (issue)
      ctx.addIssue({ code: 'custom', path: ['value'], message: issue });
  });
export const factsSchema = z
  .object({
    version: z.literal(1),
    values: z.preprocess(
      (input) =>
        typeof input === 'object' && input !== null && !Array.isArray(input)
          ? { ...readFieldValues({}), ...input }
          : input,
      fieldValuesSchema,
    ),
    manual: z.array(fieldKeySchema),
    confirmed: z.array(fieldKeySchema).default([]),
    candidates: z.array(candidateSchema).max(500),
  })
  .strict();
export type WorkFacts = z.infer<typeof factsSchema>;
export const workSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  packageVersion: z.string(),
  revision: z.number().int(),
  inputRevision: z.number().int(),
  confirmedRevision: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const workStepSchema = z.object({
  id: z.uuid(),
  stage: z.enum([
    'parsing',
    'vision',
    'extraction',
    'reconciliation',
    'generation',
  ]),
  documentId: z.uuid().nullable(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped']),
  errorCode: z.string().nullable(),
  visuals: z
    .array(
      z.object({
        path: z.string(),
        description: z.string(),
        imageIndex: z.number().int().min(0).max(31).optional(),
      }),
    )
    .default([]),
});
export const workRunSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['analysis', 'generation']),
  status: z.enum([
    'queued',
    'running',
    'succeeded',
    'partial',
    'failed',
    'cancelled',
  ]),
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
  steps: z.array(workStepSchema),
});
export const generationSchema = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  confirmed: z.boolean(),
  status: z.enum(['queued', 'succeeded', 'partial', 'failed']),
  files: z.array(generationFileSchema),
  createdAt: z.iso.datetime(),
});
export const workResponseSchema = z.object({
  work: workSummarySchema,
  package: documentPackageSchema,
  documents: z.array(documentSchema),
  facts: factsSchema,
  runs: z.array(workRunSchema),
  generations: z.array(generationSchema),
  cursor: z.string().regex(/^\d+$/),
  cleanupPending: z.boolean(),
});
export type WorkView = z.infer<typeof workResponseSchema>;
export const worksResponseSchema = z.object({
  works: z.array(workSummarySchema),
  nextCursor: z.uuid().nullable().default(null),
});
export type WorkPage = z.infer<typeof worksResponseSchema>;
export const createWorkSchema = z
  .object({
    packageVersion: z.string().max(100),
    title: z.string().trim().min(1).max(200),
  })
  .strict();
export const editWorkSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    values: fieldValuesSchema,
  })
  .strict();
export const revisionSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
export const llmSettingsInputSchema = z
  .object({
    baseURL: z.url().max(500),
    visionModel: z.string().min(1).max(200),
    extractionModel: z.string().min(1).max(200),
    apiKey: z.string().min(1).max(8192).optional(),
  })
  .strict();
export const llmSettingsResponseSchema = z.object({
  settings: z
    .object({
      revision: z.number().int(),
      baseURL: z.string(),
      visionModel: z.string(),
      extractionModel: z.string(),
      configured: z.boolean(),
    })
    .nullable(),
  canManage: z.boolean(),
});
