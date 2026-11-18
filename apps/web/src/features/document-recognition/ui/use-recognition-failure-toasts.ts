import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  documentProcessingMessage,
  type DocumentSummary,
} from '@anyko/contracts/documents';
import { useToast } from '@anyko/ui';

import { recognitionStatusQueryOptions } from '../api/queries';
import { isRecognizing } from '../model/poll';

function queryDocuments(queries: UseQueryResult<DocumentSummary | null>[]) {
  return queries.flatMap(({ data }) => (data ? [data] : []));
}

export function useRecognitionFailureToasts(
  workspaceId: string,
  documents: DocumentSummary[],
) {
  const { add } = useToast();
  const previous = useRef(new Map<string, DocumentSummary>());
  const finished = useRef(new Map<string, number>());
  const [attempts, setAttempts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const trackPending = useCallback((items: DocumentSummary[]) => {
    const running = items.filter(isRecognizing);
    if (!running.length) return;
    const completed = new Map(finished.current);
    setAttempts((current) => {
      const next = new Map(current);
      for (const [id, revision] of completed) {
        if ((next.get(id) ?? Infinity) <= revision) next.delete(id);
      }
      for (const document of running) {
        const revision = document.processingRevision ?? 0;
        if (revision > (completed.get(document.id) ?? -1))
          next.set(document.id, Math.max(revision, next.get(document.id) ?? 0));
      }
      return next;
    });
  }, []);
  const track = useCallback(
    (document: DocumentSummary) => {
      trackPending([document]);
    },
    [trackPending],
  );
  const visibleIds = new Set(documents.map(({ id }) => id));
  const background = useQueries({
    queries: [...attempts]
      .filter(([id]) => !visibleIds.has(id))
      .map(([id, revision]) =>
        recognitionStatusQueryOptions(workspaceId, id, revision),
      ),
    combine: queryDocuments,
  });
  const observed = useMemo(
    () => [...documents, ...background],
    [documents, background],
  );

  useEffect(() => {
    const failures: string[] = [];
    const completed = new Map<string, number>();
    for (const document of observed) {
      const before = previous.current.get(document.id);
      const revision = document.processingRevision ?? 0;
      const expected = attempts.get(document.id);
      if (expected !== undefined && revision < expected) continue;
      if (isRecognizing(document)) continue;
      if (expected !== undefined) completed.set(document.id, revision);
      if (
        document.status !== 'failed' ||
        document.errorCode === 'OCR_RETRY_REQUIRED' ||
        finished.current.get(document.id) === revision
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
      observed.map((document) => [document.id, document]),
    );
    finished.current = new Map([
      ...[...finished.current].filter(
        ([id, revision]) => (attempts.get(id) ?? Infinity) <= revision,
      ),
      ...completed,
    ]);
    if (failures.length) {
      add({
        title: 'Ошибка распознавания',
        description: failures.join('\n'),
        variant: 'error',
        mode: 'persistent',
      });
    }
  }, [add, attempts, observed]);
  return { track, trackPending, observed };
}
