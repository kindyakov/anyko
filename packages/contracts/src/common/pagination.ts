import { z } from 'zod';

const page = z.number().int().min(1);
const size = z.number().int().min(1).max(100);
const cursor = z.string().min(1);

type ListMode = 'page' | 'cursor';
const listQueries = z.registry<{ mode: ListMode }>();
const listResponses = z.registry<{ mode: ListMode }>();

export function pageQuery<
  T extends z.ZodType<number, number>,
  F extends z.ZodRawShape,
>(pageSize: T, defaultSize: z.output<T>, filters: F) {
  return z
    .strictObject({
      ...filters,
      page: z.coerce.number<string | number>().pipe(page).default(1),
      pageSize: z.coerce
        .number<string | number>()
        .pipe(size)
        .pipe(pageSize)
        .prefault(defaultSize),
    })
    .register(listQueries, { mode: 'page' });
}

export function cursorQuery<F extends z.ZodRawShape>(filters: F) {
  return z
    .object({
      ...filters,
      after: cursor.optional(),
      limit: z.coerce.number<string | number>().pipe(size).default(50),
    })
    .register(listQueries, { mode: 'cursor' });
}

export const cursorQuerySchema = cursorQuery({});

export function listQueryMode(schema: z.ZodObject | undefined) {
  return schema && listQueries.get(schema)?.mode;
}

export function pageResponseSchema<
  T extends z.ZodType,
  F extends z.ZodRawShape,
>(item: T, extra: F) {
  return z
    .strictObject({
      ...extra,
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
