import type { FieldRow } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import { attachmentCategory } from '@anyko/document-values/attachments';

export interface AttachmentSuggestion {
  row: FieldRow;
  page?: number;
}

export function attachmentSuggestions(
  candidates: WorkView['facts']['candidates'],
) {
  const byDocument = new Map<string, Map<string, AttachmentSuggestion>>();
  for (const candidate of candidates) {
    if (
      candidate.field !== 'attachments' ||
      candidate.origin === 'inference' ||
      !Array.isArray(candidate.value) ||
      candidate.value.length !== 1
    )
      continue;
    const source = candidate.evidence[0];
    const row = candidate.value[0];
    if (
      !source ||
      !row?.description?.trim() ||
      !attachmentCategory(row.category) ||
      candidate.evidence.some(
        ({ documentId }) => documentId !== source.documentId,
      )
    )
      continue;
    const options =
      byDocument.get(source.documentId) ??
      new Map<string, AttachmentSuggestion>();
    options.set(JSON.stringify([row.description, row.category]), {
      row,
      ...(source.page !== undefined && { page: source.page }),
    });
    byDocument.set(source.documentId, options);
  }
  return byDocument;
}
