import { z } from 'zod';

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
export type Session = z.infer<typeof sessionResponseSchema>;
