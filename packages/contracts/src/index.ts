import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });
export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
export type Session = z.infer<typeof sessionResponseSchema>;
export * from './documents';
export * from './errors';
export * from './session-cookie';
export * from './works';
