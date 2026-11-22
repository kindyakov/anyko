import { z } from 'zod';

import { candidateSchema } from './candidate';
import { fieldKeySchema } from './fields';

export const analysisDiscrepancySchema = z.strictObject({
  fields: z.array(fieldKeySchema).min(1).max(8),
  explanation: z.string().trim().min(1).max(2000),
  evidence: candidateSchema.shape.evidence.min(2),
});
export type AnalysisDiscrepancy = z.infer<typeof analysisDiscrepancySchema>;

const missingFieldReasonSchema = z.enum([
  'not_in_sources',
  'unreadable_source',
  'lawyer_required',
]);
export const analysisMissingFieldSchema = z.strictObject({
  field: fieldKeySchema,
  reason: missingFieldReasonSchema,
});
export type AnalysisMissingField = z.infer<typeof analysisMissingFieldSchema>;

export const analysisProposalFeedbackSchema = z.strictObject({
  field: fieldKeySchema,
  fieldEmpty: z.boolean(),
  disposition: z.enum(['value_projected', 'saved_for_review', 'rejected']),
  reason: z.string().optional(),
});
export type AnalysisProposalFeedback = z.infer<
  typeof analysisProposalFeedbackSchema
>;

export const missingFieldReasonLabels = {
  not_in_sources: 'Сведений нет в источниках',
  unreadable_source: 'Источник неразборчив',
  lawyer_required: 'Заполняет юрист',
} satisfies Record<AnalysisMissingField['reason'], string>;
