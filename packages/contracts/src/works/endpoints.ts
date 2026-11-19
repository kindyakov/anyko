import { z } from 'zod';

import {
  endpoint,
  eventStream,
  fileDownload,
  json,
  multipart,
  pageQuery,
  workspaceParams,
} from '../common';
import {
  deletingStatusSchema,
  documentResponseSchema,
  documentResultSchema,
  uploadFileSchema,
} from '../documents';

import { agentHistoryPage, agentHistoryRunPage } from './agent-history';
import {
  createdWorkResponseSchema,
  createWorkSchema,
  defaultWorkPageSize,
  editWorkSchema,
  queuedStatusSchema,
  revisionSchema,
  workDeletionResponseSchema,
  workDocumentSelectionSchema,
  workListStatusSchema,
  workPageSizeSchema,
  workResponseSchema,
  worksResponseSchema,
} from './schemas';

const uuid = z.uuid();
const workParams = workspaceParams.extend({ workId: uuid });
const workDocumentParams = workParams.extend({ documentId: uuid });
const ocrRevisionQuery = z.object({
  revision: z.coerce
    .number<string | number>()
    .int()
    .positive()
    .max(2147483647)
    .optional(),
});

export const listWorks = endpoint({
  summary: 'Возвращает страницу работ рабочей области',
  method: 'GET',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  query: pageQuery(workPageSizeSchema, defaultWorkPageSize, {
    q: z.string().trim().max(200).optional(),
    status: workListStatusSchema.optional(),
  }),
  response: json(worksResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const createWork = endpoint({
  summary: 'Создаёт работу по шаблону и добавляет выбранные источники',
  method: 'POST',
  path: '/workspaces/:workspaceId/works',
  params: workspaceParams,
  body: json(createWorkSchema),
  response: json(createdWorkResponseSchema),
  status: 201,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'INVALID_WORK_INPUT',
    'NOT_READY',
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

export const deleteWork = endpoint({
  summary: 'Принимает запрос на удаление работы',
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
  summary: 'Возвращает состояние удаления работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/deletion',
  params: workParams,
  response: json(workDeletionResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getWork = endpoint({
  summary:
    'Возвращает данные работы, расхождения в сведениях, отметки выбранных кандидатов и доступность команд',
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

export const listWorkAnalysisRuns = endpoint({
  summary: 'Возвращает страницу запусков автоматического анализа работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/runs',
  params: workParams,
  query: pageQuery(z.number().int().min(1).max(20), 10, {}),
  response: json(agentHistoryRunPage),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'CLEANUP_PENDING', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
});

export const getWorkAgentHistory = endpoint({
  summary:
    'Возвращает историю вызовов модели и решений по запуску анализа работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/works/:workId/runs/:runId/agent-history',
  params: workParams.extend({ runId: uuid }),
  query: pageQuery(z.number().int().min(1).max(10), 5, {}),
  response: json(agentHistoryPage),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'CLEANUP_PENDING', 'INVALID_WORK_INPUT'],
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
    'REVISION_CONFLICT',
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

export const attachWorkDocuments = endpoint({
  summary: 'Добавляет выбранные исходные документы из каталога в работу',
  method: 'POST',
  path: '/workspaces/:workspaceId/works/:workId/attach',
  params: workParams,
  body: json(z.strictObject({ documentIds: workDocumentSelectionSchema })),
  response: json(z.object({ status: z.literal('attached') })),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'REVISION_CONFLICT',
    'INVALID_WORK_INPUT',
    'NOT_READY',
    'WORK_BUSY',
    'CLEANUP_PENDING',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'natural',
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
  query: ocrRevisionQuery,
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
  query: ocrRevisionQuery,
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT', 'NOT_READY'],
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
    'CONNECTION_REVOKED',
    'WORK_BUSY',
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'key',
});

export const removeWorkDocument = endpoint({
  summary: 'Убирает связь исходного документа с работой',
  method: 'DELETE',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId',
  params: workDocumentParams,
  response: json(deletingStatusSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'REVISION_CONFLICT', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  // Повтор после принятого удаления даёт NOT_FOUND для того же документа.
  idempotency: 'natural',
});

export const editWorkDocumentRecognition = endpoint({
  summary: 'Обновляет закреплённую версию распознавания исходника работы',
  method: 'PATCH',
  path: '/workspaces/:workspaceId/works/:workId/documents/:documentId',
  params: workDocumentParams,
  body: json(
    z.strictObject({
      ocrRevision: z.number().int().positive().max(2147483647),
    }),
  ),
  response: json(z.object({ status: z.literal('updated') })),
  status: 200,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'REVISION_CONFLICT',
    'CLEANUP_PENDING',
    'NOT_READY',
    'WORK_BUSY',
    'INVALID_WORK_INPUT',
  ],
  invalid: 'INVALID_WORK_INPUT',
  idempotency: 'natural',
});

export const editWork = endpoint({
  summary: 'Сохраняет правки полей работы',
  method: 'PATCH',
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
    'NOT_READY',
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
