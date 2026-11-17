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
  documentResultSchema,
  uploadFileSchema,
} from '../documents';

import {
  createWorkSchema,
  editWorkSchema,
  queuedStatusSchema,
  revisionSchema,
  workDeletionResponseSchema,
  workListStatusSchema,
  workPageSizeSchema,
  workResponseSchema,
  worksResponseSchema,
} from './schemas';

const uuid = z.uuid();
const workParams = workspaceParams.extend({ workId: uuid });
const workDocumentParams = workParams.extend({ documentId: uuid });

export const listWorks = endpoint({
  summary: 'Возвращает страницу работ рабочей области',
  method: 'GET',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  // Пустой after означает первую страницу, как и раньше.
  query: z
    .object({
      after: z.union([uuid, z.literal('')]).optional(),
      page: z.coerce.number<string | number>().int().positive().optional(),
      pageSize: z.coerce
        .number<string | number>()
        .pipe(workPageSizeSchema)
        .optional(),
      q: z.string().trim().max(200).optional(),
      status: workListStatusSchema.optional(),
    })
    .refine(
      ({ after, page, pageSize, q, status }) =>
        !after ||
        (page === undefined &&
          pageSize === undefined &&
          q === undefined &&
          status === undefined),
    ),
  response: json(worksResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const createWork = endpoint({
  summary: 'Создаёт работу по выбранному шаблону',
  method: 'POST',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  body: json(createWorkSchema),
  response: json(workResponseSchema),
  status: 201,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'INVALID_WORK_INPUT',
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

export const deleteWork = endpoint({
  method: 'DELETE',
  path: '/workspaces/:workspaceId/works/:workId',
  params: workParams,
  response: json(workDeletionResponseSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
  idempotency: 'natural',
});

export const getWorkDeletion = endpoint({
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/deletion',
  params: workParams,
  response: json(workDeletionResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getWork = endpoint({
  summary: 'Возвращает данные работы и состояние её подготовки',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId',
  params: workParams,
  response: json(workResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const streamWorkEvents = endpoint({
  summary: 'Передаёт поток событий работы',
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
  summary: 'Добавляет исходный документ к работе и запускает распознавание',
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/documents',
  params: workParams,
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
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

// Исходный документ работы: документ должен принадлежать этой работе, иначе NOT_FOUND.
export const getWorkDocumentSource = endpoint({
  summary: 'Скачивает исходный документ работы',
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

// Результат распознавания исходного документа работы: та же схема, что у распознавания вне работы.
// Ссылки на изображения ведут на изображения этой работы (getWorkDocumentImage).
export const getWorkDocumentResult = endpoint({
  summary: 'Возвращает результат распознавания исходного документа работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId/result',
  params: workDocumentParams,
  response: json(documentResultSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT', 'NOT_READY'],
  invalid: 'INVALID_WORK_INPUT',
});

export const getWorkDocumentImage = endpoint({
  summary: 'Скачивает изображение из результата распознавания документа работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId/images/:index',
  params: workDocumentParams.extend({ index: z.string() }),
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const analyzeWork = endpoint({
  summary: 'Запускает анализ исходных документов работы',
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
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

export const removeWorkDocument = endpoint({
  summary: 'Принимает запрос на удаление исходного документа из работы',
  method: 'DELETE',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId',
  params: workDocumentParams,
  response: json(deletingStatusSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  // Повтор после принятого удаления даёт NOT_FOUND для того же документа.
  idempotency: 'natural',
});

export const editWork = endpoint({
  summary: 'Сохраняет правки полей работы',
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
  // Правка с ревизией: повтор со старой ревизией даёт REVISION_CONFLICT, без изменения данных.
  idempotency: 'natural',
});

export const confirmWork = endpoint({
  summary: 'Подтверждает сведения работы',
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
  // Подтверждение с ревизией: повтор после подтверждения не меняет подтверждённые сведения.
  idempotency: 'natural',
});

export const generateWork = endpoint({
  summary: 'Запускает формирование выходных документов работы',
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
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

export const downloadGeneratedFile = endpoint({
  summary: 'Скачивает сформированный файл работы',
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
