import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });
export const httpErrorSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    requestId: z.string().max(128),
  }),
});
export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
export type Session = z.infer<typeof sessionResponseSchema>;
export * from './documents';
export * from './works';
