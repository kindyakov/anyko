import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });
export const readinessResponseSchema = z.object({ status: z.enum(['ready', 'stopping']) });
export const httpErrorSchema = z.object({
  error: z.object({
    code: z.enum(['NOT_FOUND', 'INVALID_REQUEST', 'INTERNAL_ERROR', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT']),
    requestId: z.uuid(),
  }),
});
export type HttpErrorCode = z.infer<typeof httpErrorSchema>['error']['code'];
