import { z } from 'zod';
export const documentResultSchema = z.object({
  version: z.literal(2),
  markdown: z.string().max(4 * 1024 * 1024),
  processorVersion: z.string().min(1).max(128),
  images: z
    .array(
      z.object({
        path: z
          .string()
          .regex(/^images\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i),
        contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        key: z.string().min(1).max(1024),
        size: z
          .number()
          .int()
          .min(1)
          .max(3 * 1024 * 1024),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(32),
});
