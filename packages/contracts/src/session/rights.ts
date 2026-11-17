import { z } from 'zod';

// Каталог именованных прав (ADR 0009). Сверяется с каталогом backend тестом apps/api:
// добавление права меняет оба списка одновременно.
export const rightSchema = z.enum([
  'works.read',
  'works.create',
  'works.edit',
  'works.generate',
  'documents.upload',
  'documents.delete',
  'recognitions.use',
  'connections.read',
  'connections.manage',
  'members.invite',
]);

export const rights = rightSchema.options;

export type Right = z.infer<typeof rightSchema>;
