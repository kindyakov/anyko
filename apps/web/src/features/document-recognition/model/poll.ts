import type { DocumentSummary } from '@anyko/contracts/documents';

export function isRecognizing(document: Pick<DocumentSummary, 'status'>) {
  return document.status === 'queued' || document.status === 'running';
}
