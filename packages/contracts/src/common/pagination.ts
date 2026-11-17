import { z } from 'zod';

const page = z.number().int().min(1);
const size = z.number().int().min(1).max(100);
const cursor = z.string().min(1);

export const pageQuerySchema = z.object({
  page: z.coerce.number<string | number>().pipe(page).default(1),
  pageSize: z.coerce.number<string | number>().pipe(size).default(50),
});

export const cursorQuerySchema = z.object({
  after: cursor.optional(),
  limit: z.coerce.number<string | number>().pipe(size).default(50),
});

const listResponses = z.registry<{ mode: 'page' | 'cursor' }>();

export function pageResponseSchema<T extends z.ZodType>(item: T) {
  return z
    .strictObject({
      items: z.array(item),
      page,
      pageSize: size,
      total: z.number().int().nonnegative(),
    })
    .register(listResponses, { mode: 'page' });
}

export function cursorResponseSchema<T extends z.ZodType>(item: T) {
  return z
    .strictObject({
      items: z.array(item),
      nextCursor: cursor.nullable(),
    })
    .register(listResponses, { mode: 'cursor' });
}

export function listResponseMode(schema: z.ZodType) {
  return listResponses.get(schema)?.mode;
}
