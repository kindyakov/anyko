import { expect, test } from 'bun:test';

import type { DocumentStore, DocumentView } from '..';
import { memberScope } from '../../../../tests/support/scope';
import { isAppError } from '../../../platform/errors';
import { brandDocumentId } from '../../../platform/ids';

import { readDocument } from './read-document';
import { removeDocument } from './remove';
import { retryDocument } from './retry';

const DOCUMENT_ID = '0190f0a0-0000-7000-8000-000000000002';
const WORKSPACE = 'workspace-1';

const failed: DocumentView = {
  id: DOCUMENT_ID,
  filename: 'statement.pdf',
  status: 'failed',
  createdAt: '2026-11-01T00:00:00.000Z',
  errorCode: 'OCR_FAILED',
};
const queued: DocumentView = { ...failed, status: 'queued', errorCode: null };

// Заглушки портов: неожиданный вызов падает, поэтому тест видит, какие операции выполнены.
const unused = () => Promise.reject(new Error('UNUSED'));
function store(overrides: Partial<DocumentStore>): DocumentStore {
  return {
    source: unused,
    stageSource: unused,
    forgetSource: unused,
    register: unused,
    list: unused,
    pendingDeletions: unused,
    get: unused,
    readyResult: unused,
    remove: unused,
    deletion: unused,
    deletionImpact: unused,
    image: unused,
    assertUploadAllowed: unused,
    retry: unused,
    ...overrides,
  };
}

async function failureOf(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('EXPECTED_FAILURE');
}

test('removing a recognition document without recognitions.use is forbidden before the store is touched', async () => {
  const calls: string[] = [];
  const remove = removeDocument({
    store: store({
      remove: () => {
        calls.push('remove');
        return Promise.resolve(true);
      },
    }),
  });
  const error = await failureOf(
    remove.recognition(
      memberScope(WORKSPACE, 'lawyer', ['documents.delete']),
      brandDocumentId(DOCUMENT_ID),
    ),
  );
  expect(isAppError(error) && error.code).toBe('FORBIDDEN');
  expect(calls).toEqual([]);
});

test('retrying a failed document queues a new attempt with the request correlation and the actor', async () => {
  const seen: unknown[] = [];
  const retry = retryDocument({
    store: store({
      retry: (workspaceId, documentId, actorId, correlationId) => {
        seen.push([workspaceId, documentId, actorId, correlationId]);
        return Promise.resolve(queued);
      },
    }),
  });
  const result = await retry.recognition(
    memberScope(WORKSPACE, 'lawyer'),
    brandDocumentId(DOCUMENT_ID),
    'correlation-1',
  );
  expect(result.status).toBe('queued');
  expect(seen).toEqual([[WORKSPACE, DOCUMENT_ID, 'lawyer', 'correlation-1']]);
});

test('retrying when the store reports no retryable document is a conflict, not a success', async () => {
  const retry = retryDocument({
    store: store({ retry: () => Promise.resolve(null) }),
  });
  const error = await failureOf(
    retry.recognition(
      memberScope(WORKSPACE, 'lawyer'),
      brandDocumentId(DOCUMENT_ID),
      'correlation-2',
    ),
  );
  expect(isAppError(error) && error.code).toBe('RETRY_CONFLICT');
});

test('reading a document that the store does not have is not_found for the scope', async () => {
  const read = readDocument({
    store: store({ get: () => Promise.resolve(null) }),
  });
  const error = await failureOf(
    read.recognition(memberScope(WORKSPACE), brandDocumentId(DOCUMENT_ID)),
  );
  expect(isAppError(error) && error.code).toBe('NOT_FOUND');
});
