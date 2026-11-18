import { z } from 'zod';

import { documentImageLimit } from '../../../platform/document-output';

const coordinate = z.number().min(0).max(1);
const box = z
  .tuple([coordinate, coordinate, coordinate, coordinate])
  .refine(([left, top, right, bottom]) => left < right && top < bottom);
export const pdfOcrSchema = z.object({
  version: z.literal(1),
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        omittedLines: z.number().int().nonnegative(),
        lines: z
          .array(
            z.object({
              text: z.string().min(1).max(2000),
              confidence: coordinate,
              bbox: box,
            }),
          )
          .max(1000),
      }),
    )
    .max(1000),
});

export const documentResultSchema = z.object({
  version: z.literal(2),
  markdown: z.string().max(4 * 1024 * 1024),
  processorVersion: z.string().min(1).max(128),
  pdfOcr: pdfOcrSchema.optional(),
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
    .max(documentImageLimit),
});
