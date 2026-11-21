import { submittedAttachmentsField } from '@anyko/document-values/attachments';

import type { WorkFacts } from '../../modules/facts';

import { supportingAttachmentCandidates } from './attachment-candidates';
import type { ChecklistAnalysisSource } from './checklist-suggestions';

type Candidates = WorkFacts['candidates'];

export function attachmentAnalysis(
  found: Candidates,
  extracted: Candidates = [],
  sources: ChecklistAnalysisSource[] = [],
) {
  const suggestions = supportingAttachmentCandidates(found, sources);
  const egrnIds = new Set(
    [...extracted, ...found, ...suggestions]
      .filter(
        ({ field, value, origin }) =>
          field === 'attachments' &&
          origin !== 'inference' &&
          Array.isArray(value) &&
          value.some(({ category }) => category === 'egrn'),
      )
      .flatMap(({ evidence }) => evidence.map(({ documentId }) => documentId)),
  );
  return [
    ...suggestions,
    ...found.filter(
      ({ field, evidence }) =>
        field !== submittedAttachmentsField &&
        (!['propertyDetails', 'observations'].includes(field) ||
          !evidence.some(({ documentId }) => egrnIds.has(documentId))),
    ),
  ];
}
