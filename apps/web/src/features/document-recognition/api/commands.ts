import { z } from 'zod';

import {
  documentResponseSchema,
  documentsResponseSchema,
} from '@anyko/contracts/documents';

import { requestApi } from '@/lib/api/client';

const deletionStarted = z.object({ status: z.literal('deleting') });
const deletionProgress = z.object({
  status: z.enum(['deleting', 'deleted', 'needs-recovery']),
});

export function listDocuments(signal?: AbortSignal) {
  return requestApi(
    '/documents',
    documentsResponseSchema,
    signal ? { signal } : {},
  );
}

export function uploadDocument(file: File) {
  const body = new FormData();
  body.set('file', file);
  return requestApi('/documents', documentResponseSchema, {
    method: 'POST',
    body,
    headers: { 'idempotency-key': crypto.randomUUID() },
  });
}

export function retryDocument(id: string) {
  return requestApi(
    `/documents/${encodeURIComponent(id)}/retry`,
    documentResponseSchema,
    { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } },
  );
}

export function startDocumentDeletion(id: string) {
  return requestApi(`/documents/${encodeURIComponent(id)}`, deletionStarted, {
    method: 'DELETE',
  });
}

export function documentDeletionProgress(id: string) {
  return requestApi(
    `/documents/${encodeURIComponent(id)}/deletion`,
    deletionProgress,
  );
}
