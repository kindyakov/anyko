import { z } from 'zod';

import {
  endpoint,
  eventStream,
  fileDownload,
  json,
  multipart,
  workspaceParams,
} from '../common';
import {
  deletingStatusSchema,
  documentResponseSchema,
  uploadFileSchema,
} from '../documents';

import {
  createWorkSchema,
  editWorkSchema,
  queuedStatusSchema,
  revisionSchema,
  workResponseSchema,
  worksResponseSchema,
} from './schemas';

const uuid = z.uuid();
const workParams = workspaceParams.extend({ workId: uuid });
const workDocumentParams = workParams.extend({ documentId: uuid });
// Идемпотентность загрузки держится на ключе запроса в документах и работе.
const idempotencyKey = z.object({ 'idempotency-key': uuid });

export const listWorks = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  // Пустой after означает первую страницу, как и раньше.
  query: z.object({ after: z.union([uuid, z.literal('')]).optional() }),
  response: json(worksResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const createWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  body: json(createWorkSchema),
  response: json(workResponseSchema),
  status: 201,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

export const getWork = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId',
  params: workParams,
  response: json(workResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const streamWorkEvents = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/events',
  params: workParams,
  query: z.object({ after: z.string().optional() }),
  headers: z.object({ 'last-event-id': z.string().optional() }),
  response: eventStream(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT', 'STREAM_LIMIT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const uploadWorkDocument = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/documents',
  params: workParams,
  headers: idempotencyKey,
  body: multipart({ file: uploadFileSchema }),
  response: json(documentResponseSchema),
  status: 202,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'INVALID_WORK_INPUT',
    'INVALID_DOCUMENT',
    'UNSUPPORTED_DOCUMENT_FORMAT',
    'IDEMPOTENCY_CONFLICT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: true,
});

// Исходный документ работы: документ должен принадлежать этой работе, иначе NOT_FOUND.
export const getWorkDocumentSource = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId/source',
  params: workDocumentParams,
  response: fileDownload(),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'INVALID_WORK_INPUT',
    'UNSUPPORTED_DOCUMENT_FORMAT',
  ],
  invalid: 'INVALID_WORK_INPUT',
});

export const getWorkDocumentImage = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId/images/:index',
  params: workDocumentParams.extend({ index: z.string() }),
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const analyzeWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/analyze',
  params: workParams,
  response: json(queuedStatusSchema),
  status: 202,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'INVALID_WORK_INPUT',
    'LLM_NOT_CONFIGURED',
    'WORK_BUSY',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

export const removeWorkDocument = endpoint({
  method: 'DELETE',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId',
  params: workDocumentParams,
  response: json(deletingStatusSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: true,
});

export const editWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/fields',
  params: workParams,
  body: json(editWorkSchema),
  response: json(workResponseSchema),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'REVISION_CONFLICT',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

export const confirmWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/confirm',
  params: workParams,
  body: json(revisionSchema),
  response: json(workResponseSchema),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'REVISION_CONFLICT',
    'WORK_BUSY',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

export const generateWork = endpoint({
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/generate',
  params: workParams,
  body: json(revisionSchema),
  response: json(queuedStatusSchema),
  status: 202,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'REVISION_CONFLICT',
    'WORK_BUSY',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});

export const downloadGeneratedFile = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/generations/:generationId/files/:fileId',
  params: workParams.extend({ generationId: uuid, fileId: uuid }),
  response: fileDownload(),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'CLEANUP_PENDING',
    'NOT_READY',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
});
