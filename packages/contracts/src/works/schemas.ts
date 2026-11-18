import { z } from 'zod';

import {
  documentPackageSchema,
  fieldKeySchema,
  fieldValueSchema,
  fieldValuesSchema,
  generationFileSchema,
} from '../catalog';
import { pageResponseSchema } from '../common';
import { documentSchema } from '../documents';

import { agentSessionSchema } from './agent-session';

export * from './agent-session';

export const evidenceSchema = z
  .object({
    documentId: z.uuid(),
    imagePath: z.string().max(240).nullable(),
    quote: z.string().max(2000),
    page: z.number().int().positive().optional(),
  })
  .strict();
export const candidateSchema = z
  .object({
    origin: z.enum(['document', 'context']).optional(),
    field: fieldKeySchema,
    selected: z
      .boolean()
      .describe('Значение кандидата вошло в сохранённые сведения'),
    value: fieldValueSchema.refine(
      (value) =>
        value !== null &&
        (typeof value !== 'string' || value.trim().length > 0),
    ),
    evidence: z.array(evidenceSchema).min(1).max(12),
  })
  .strict();
export const factsSchema = z
  .object({
    version: z.literal(1),
    values: fieldValuesSchema,
    manual: z.array(fieldKeySchema),
    confirmed: z.array(fieldKeySchema).default([]),
    needsReview: z.array(fieldKeySchema).optional(),
    candidates: z.array(candidateSchema).max(500),
    discrepancyFields: z.array(fieldKeySchema),
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
        imageIndex: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
});
export const workRunSchema = z.object({
  id: z.uuid(),
  inputRevision: z.number().int().optional(),
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
const workCommandBlockReasonSchema = z.enum([
  'WORK_BUSY',
  'FACTS_NEED_REVIEW',
  'CLEANUP_PENDING',
  'NO_DOCUMENTS',
  'SOURCE_LIMIT_REACHED',
  'CONNECTION_REVOKED',
  'LLM_NOT_CONFIGURED',
  'FORBIDDEN',
]);
export type WorkCommandBlockReason = z.infer<
  typeof workCommandBlockReasonSchema
>;
const workCommandAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true) }),
  z.object({
    available: z.literal(false),
    reason: workCommandBlockReasonSchema,
  }),
]);
const workAvailabilitySchema = z.object({
  analyze: workCommandAvailabilitySchema,
  generate: workCommandAvailabilitySchema,
  confirm: workCommandAvailabilitySchema,
  upload: workCommandAvailabilitySchema,
  remove: workCommandAvailabilitySchema,
  attach: workCommandAvailabilitySchema,
  updateRecognition: workCommandAvailabilitySchema,
});
export const workResponseSchema = z.object({
  work: workSummarySchema,
  session: agentSessionSchema.nullable().optional(),
  package: documentPackageSchema,
  documents: z.array(documentSchema),
  facts: factsSchema,
  runs: z.array(workRunSchema),
  generations: z.array(generationSchema),
  cursor: z.string().regex(/^\d+$/),
  cleanupPending: z.boolean(),
  availability: workAvailabilitySchema,
});
export type WorkView = z.infer<typeof workResponseSchema>;
// Повтор создания может вернуть ответ, сохранённый до появления списка и отметок.
export const createdWorkResponseSchema = workResponseSchema.extend({
  availability: workAvailabilitySchema
    .partial({ attach: true, updateRecognition: true })
    .optional(),
  facts: factsSchema.extend({
    discrepancyFields: factsSchema.shape.discrepancyFields.default([]),
    candidates: z
      .array(
        candidateSchema.extend({
          selected: candidateSchema.shape.selected.default(false),
        }),
      )
      .max(500),
  }),
});
export const workListStatusSchema = z.enum(['all', 'draft', 'confirmed']);
export type WorkListStatus = z.infer<typeof workListStatusSchema>;
export const workPageSizes = [6, 12, 24, 48] as const;
export const defaultWorkPageSize = 24;
export const workPageSizeSchema = z.literal(workPageSizes);
const workDeletionStatus = z.enum(['deleting', 'needs-recovery']);
export const workDeletionResponseSchema = z.object({
  status: z.union([workDeletionStatus, z.literal('deleted')]),
});
export const worksResponseSchema = pageResponseSchema(workSummarySchema, {
  deletions: z.array(z.object({ id: z.uuid(), status: workDeletionStatus })),
});
export type WorkPage = z.infer<typeof worksResponseSchema>;
export const workSourceLimit = 20;
export const workDocumentSelectionSchema = z
  .array(z.uuid())
  .min(1)
  .max(workSourceLimit);
export const createWorkSchema = z
  .object({
    packageVersion: z.string().max(100),
    title: z.string().trim().min(1).max(200),
    documentIds: workDocumentSelectionSchema.optional(),
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
export const queuedStatusSchema = z.object({ status: z.literal('queued') });
