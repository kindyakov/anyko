import { submittedAttachmentsField } from '@anyko/document-values/attachments';

import type { WorkFacts } from '../../modules/facts';

type Candidates = WorkFacts['candidates'];

export function attachmentAnalysis(
  found: Candidates,
  extracted: Candidates = [],
) {
  const egrnIds = new Set(
    [...extracted, ...found]
      .filter(
        ({ field, value, origin }) =>
          field === 'attachments' &&
          origin !== 'inference' &&
          Array.isArray(value) &&
          value.some(({ category }) => category === 'egrn'),
      )
      .flatMap(({ evidence }) => evidence.map(({ documentId }) => documentId)),
  );
  return found.filter(
    ({ field, evidence }) =>
      field !== submittedAttachmentsField &&
      (!['propertyDetails', 'observations'].includes(field) ||
        !evidence.some(({ documentId }) => egrnIds.has(documentId))),
  );
}
