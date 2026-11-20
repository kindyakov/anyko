import { z } from 'zod';

export const checklistSuggestionSchema = z.object({
  requirementKey: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/),
  documentId: z.uuid(),
  decision: z.enum(['found', 'review']),
  quote: z.string().trim().min(1).max(2000),
  imagePath: z.string().max(240).nullable(),
});
export type ChecklistSuggestion = z.infer<typeof checklistSuggestionSchema>;
