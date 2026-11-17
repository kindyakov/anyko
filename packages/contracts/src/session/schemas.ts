import { z } from 'zod';

import { rightSchema } from './rights';

// Ответ сессии: участия пользователя и права каждого участия. Роль не возвращается:
// web проверяет право через список прав, а не через название роли.
export const membershipSchema = z.object({
  workspace: z.object({ id: z.string(), name: z.string() }),
  rights: z.array(rightSchema),
});

export const sessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  memberships: z.array(membershipSchema),
});
export type Session = z.infer<typeof sessionResponseSchema>;
export type Membership = z.infer<typeof membershipSchema>;
