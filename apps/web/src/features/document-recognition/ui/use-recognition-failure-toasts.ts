import { useCallback, useEffect, useRef } from 'react';

import {
  documentProcessingMessage,
  type DocumentSummary,
} from '@anyko/contracts/documents';
import { useToast } from '@anyko/ui';

export function useRecognitionFailureToasts(documents: DocumentSummary[]) {
  const { add } = useToast();
  const previous = useRef(new Map<string, DocumentSummary>());
  const tracked = useRef(new Map<string, number>());
  const track = useCallback((document: DocumentSummary) => {
    tracked.current.set(document.id, document.processingRevision ?? 0);
  }, []);

  useEffect(() => {
    const failures: string[] = [];
    for (const document of documents) {
      const before = previous.current.get(document.id);
      const revision = document.processingRevision ?? 0;
      const expected = tracked.current.get(document.id);
      if (expected !== undefined && revision < expected) continue;
      if (document.status === 'queued' || document.status === 'running')
        continue;
      tracked.current.delete(document.id);
      if (
        document.status !== 'failed' ||
        document.errorCode === 'OCR_RETRY_REQUIRED'
      )
        continue;
      const sameFailure =
        before?.status === 'failed' &&
        before.processingRevision === document.processingRevision;
      if (sameFailure || (!before && expected === undefined)) continue;
      const code = document.errorCode || 'OCR_FAILED';
      const message =
        document.errorMessage ??
        documentProcessingMessage(code) ??
        'Не удалось распознать документ.';
      failures.push(`${document.filename}: ${message} (${code})`);
    }
    previous.current = new Map(
      documents.map((document) => [document.id, document]),
    );
    if (failures.length) {
      add({
        title: 'Ошибка распознавания',
        description: failures.join('\n'),
        variant: 'error',
        mode: 'persistent',
      });
    }
  }, [add, documents]);
  return track;
}
