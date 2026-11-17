import { z } from 'zod';

import { type FieldValues, workResponseSchema } from '@anyko/contracts';

import { requestApi } from '@/lib/api/client';

const accepted = z.object({ status: z.string() });

// Несохранённые правки полей: значения и ревизия работы, на которой они начаты.
export type FactsDraft = { values: FieldValues; revision: number };

export function analyzeWork(workId: string) {
  return requestApi(`/works/${workId}/analyze`, accepted, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function confirmWork(workId: string, revision: number) {
  return requestApi(`/works/${workId}/confirm`, workResponseSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ revision }),
  });
}

export function saveFacts(workId: string, draft: FactsDraft) {
  return requestApi(`/works/${workId}/fields`, workResponseSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  });
}
