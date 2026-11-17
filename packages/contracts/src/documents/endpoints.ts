import { z } from 'zod';

import {
  endpoint,
  fileDownload,
  json,
  multipart,
  workspaceParams,
} from '../common';

import {
  deletingStatusSchema,
  documentDeletionSchema,
  documentResponseSchema,
  documentResultSchema,
  documentsResponseSchema,
  uploadFileSchema,
} from './schemas';

// Распознавание вне работы (термин глоссария). Неизвестный или не-UUID идентификатор даёт NOT_FOUND.
const documentParams = workspaceParams.extend({ documentId: z.uuid() });
const recognitionsPath = '/workspaces/:workspaceId/recognitions';

export const listDocuments = endpoint({
  method: 'GET',
  path: recognitionsPath,
  params: workspaceParams,
  response: json(documentsResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const uploadDocument = endpoint({
  method: 'POST',
  path: recognitionsPath,
  params: workspaceParams,
  headers: z.object({ 'idempotency-key': z.uuid() }),
  body: multipart({ file: uploadFileSchema }),
  response: json(documentResponseSchema),
  status: 202,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'INVALID_DOCUMENT',
    'UNSUPPORTED_DOCUMENT_FORMAT',
    'IDEMPOTENCY_CONFLICT',
    'INVALID_IDEMPOTENCY_KEY',
  ],
  invalid: 'INVALID_DOCUMENT',
  invalidHeaders: 'INVALID_IDEMPOTENCY_KEY',
  // Повтор с тем же ключом возвращает тот же документ (хранилище ключей в документах).
  idempotent: true,
});

export const getDocument = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId',
  params: documentParams,
  response: json(documentResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getDocumentResult = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/result',
  params: documentParams,
  response: json(documentResultSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'NOT_READY'],
  invalid: 'NOT_FOUND',
});

export const getDocumentSource = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/source',
  params: documentParams,
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'UNSUPPORTED_DOCUMENT_FORMAT'],
  invalid: 'NOT_FOUND',
});

export const getDocumentImage = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/images/:index',
  params: documentParams.extend({ index: z.string() }),
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getDocumentDeletion = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/deletion',
  params: documentParams,
  response: json(documentDeletionSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const deleteDocument = endpoint({
  method: 'DELETE',
  path: '/workspaces/:workspaceId/recognitions/:documentId',
  params: documentParams,
  response: json(deletingStatusSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
  // Повтор после принятого удаления даёт NOT_FOUND, состояние остаётся тем же.
  idempotent: true,
});

export const retryDocument = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/recognitions/:documentId/retry',
  params: documentParams,
  response: json(documentResponseSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'RETRY_CONFLICT'],
  invalid: 'NOT_FOUND',
  idempotent: false,
});
