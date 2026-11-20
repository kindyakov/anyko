import { z } from 'zod';

// The API describes the shape of values; field names and their meaning belong to the profile.
export const fieldKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[^{}#/]+$/);
export type FieldKey = z.infer<typeof fieldKeySchema>;
export const fieldRowSchema = z.record(fieldKeySchema, z.string().nullable());
export const fieldValueSchema = z
  .union([z.string(), z.array(fieldRowSchema)])
  .nullable();
export const fieldValuesSchema = z.record(fieldKeySchema, fieldValueSchema);
export type FieldRow = z.infer<typeof fieldRowSchema>;
export type FieldValue = z.infer<typeof fieldValueSchema>;
export type FieldValues = z.infer<typeof fieldValuesSchema>;
export interface FieldDefinition {
  key: FieldKey;
  label: string;
  multiline: boolean;
  kind: 'text' | 'rows';
  limits: { maxLength?: number | undefined; maxRows?: number | undefined };
  columns: { key: string; label: string; maxLength: number }[];
}
