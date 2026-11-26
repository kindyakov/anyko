import { z } from 'zod';

import { documentImageLimit } from '../../../platform/document-output';

const coordinate = z.number().min(0).max(1);
const box = z
  .tuple([coordinate, coordinate, coordinate, coordinate])
  .refine(([left, top, right, bottom]) => left < right && top < bottom);
const imagePathSchema = z
  .string()
  .regex(/^images\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i);
export const pdfTableImagesSchema = z
  .array(
    z.strictObject({
      imagePath: imagePathSchema.max(240),
      page: z.number().int().positive(),
      origin: z.enum(['native', 'unknown']),
    }),
  )
  .max(documentImageLimit)
  .refine(
    (tables) =>
      new Set(tables.map(({ imagePath }) => imagePath)).size === tables.length,
  );
export const pdfOcrSchema = z.object({
  version: z.literal(1),
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        omittedLines: z.number().int().nonnegative(),
        lines: z
          .array(
            z.union([
              z.object({
                text: z.string().min(1).max(2000),
                confidence: coordinate,
                bbox: box,
                source: z.never().optional(),
              }),
              z.object({
                text: z.string().min(1).max(2000),
                bbox: box,
                source: z.literal('primary-ocr'),
                confidence: z.never().optional(),
              }),
            ]),
          )
          .max(1000),
      }),
    )
    .max(1000),
});

export const cloudImageOcrVersion = 'vision-ocr.1';

export const pdfOcrProcessorVersionPattern =
  /[+](eslav|cyrillic-pdf)[.][0-9]+$/u;

export function hasPdfOcrProcessorVersion(version: string) {
  return pdfOcrProcessorVersionPattern.test(version);
}

export const documentResultSchema = z
  .object({
    version: z.literal(2),
    markdown: z.string().max(4 * 1024 * 1024),
    processorVersion: z.string().min(1).max(128),
    pdfOcr: pdfOcrSchema.optional(),
    tableImages: pdfTableImagesSchema.optional(),
    images: z
      .array(
        z.object({
          path: imagePathSchema,
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
  })
  .refine(
    ({ tableImages, images }) => {
      if (!tableImages) return true;
      const paths = new Set(images.map(({ path }) => path));
      return tableImages.every(({ imagePath }) => paths.has(imagePath));
    },
    { path: ['tableImages'] },
  );
