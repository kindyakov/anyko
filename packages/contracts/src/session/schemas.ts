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

// Прежняя форма `{ user, workspace }` с первым участием. Её читает web через `/api/session`
// до web #11; корень `@anyko/contracts` экспортирует её под прежними именами. Удаляется вместе с
// временным слоем (web #11).
export const legacySessionResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
export type LegacySession = z.infer<typeof legacySessionResponseSchema>;
