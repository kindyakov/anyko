import { z } from 'zod';

import {
  cursorQuery,
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
  sourceChecksumSchema,
  sourceFormatSchema,
  uploadFileSchema,
} from './schemas';

// Распознавание вне работы (термин глоссария). Неизвестный или не-UUID идентификатор даёт NOT_FOUND.
const documentParams = workspaceParams.extend({ documentId: z.uuid() });
const recognitionsPath = '/workspaces/:workspaceId/recognitions';
const resultRevisionQuery = z.object({
  revision: z.coerce.number<string | number>().int().positive().optional(),
});
const formatList = z
  .string()
  .max(sourceFormatSchema.options.join(',').length)
  .describe(
    `Comma-separated file formats: ${sourceFormatSchema.options.join(', ')}`,
  )
  .transform((value) => value.split(','))
  .pipe(
    z.array(sourceFormatSchema).min(1).max(sourceFormatSchema.options.length),
  );

export const listDocuments = endpoint({
  summary:
    'Возвращает каталог распознаваний с фильтрами по имени, формату и содержимому',
  method: 'GET',
  path: recognitionsPath,
  params: workspaceParams,
  query: cursorQuery({
    checksum: sourceChecksumSchema.optional(),
    q: z
      .string()
      .trim()
      .max(200)
      .regex(/^[^\0]*$/u)
      .optional(),
    formats: formatList.optional(),
  }),
  response: json(documentsResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_DOCUMENT'],
  invalid: 'INVALID_DOCUMENT',
});

export const uploadDocument = endpoint({
  summary: 'Загружает документ и запускает распознавание вне работы',
  method: 'POST',
  path: recognitionsPath,
  params: workspaceParams,
  body: multipart({ file: uploadFileSchema }),
  response: json(documentResponseSchema),
  status: 202,
  errors: [
    'FORBIDDEN',
    'NOT_FOUND',
    'INVALID_DOCUMENT',
    'UNSUPPORTED_DOCUMENT_FORMAT',
    'INVALID_IDEMPOTENCY_KEY',
    'IDEMPOTENCY_CONFLICT',
    'IDEMPOTENCY_IN_PROGRESS',
  ],
  invalid: 'INVALID_DOCUMENT',
  // Повтор с тем же ключом возвращает сохранённый ответ (модуль idempotency); внутренний
  // requestKey документов защищает запись файла.
  idempotency: 'key',
});

export const getDocument = endpoint({
  summary: 'Возвращает состояние распознавания вне работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId',
  params: documentParams,
  response: json(documentResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getDocumentResult = endpoint({
  summary: 'Возвращает результат распознавания вне работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/result',
  params: documentParams,
  query: resultRevisionQuery,
  response: json(documentResultSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'NOT_READY'],
  invalid: 'NOT_FOUND',
});

export const getDocumentSource = endpoint({
  summary: 'Скачивает исходный документ распознавания вне работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/source',
  params: documentParams,
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'UNSUPPORTED_DOCUMENT_FORMAT'],
  invalid: 'NOT_FOUND',
});

export const getDocumentImage = endpoint({
  summary: 'Скачивает изображение из результата распознавания вне работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/images/:index',
  params: documentParams.extend({ index: z.string() }),
  query: resultRevisionQuery,
  response: fileDownload(),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const getDocumentDeletion = endpoint({
  summary: 'Возвращает состояние удаления распознавания вне работы',
  method: 'GET',
  path: '/workspaces/:workspaceId/recognitions/:documentId/deletion',
  params: documentParams,
  response: json(documentDeletionSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_DOCUMENT'],
  invalid: 'NOT_FOUND',
});

export const deleteDocument = endpoint({
  summary: 'Принимает запрос на удаление распознавания вне работы',
  method: 'DELETE',
  path: '/workspaces/:workspaceId/recognitions/:documentId',
  params: documentParams,
  response: json(deletingStatusSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'DOCUMENT_IN_USE'],
  invalid: 'NOT_FOUND',
  // Повтор после принятого удаления даёт NOT_FOUND, состояние остаётся тем же.
  idempotency: 'natural',
});

export const retryDocument = endpoint({
  summary: 'Повторно запускает распознавание вне работы',
  method: 'POST',
  path: '/workspaces/:workspaceId/recognitions/:documentId/retry',
  params: documentParams,
  response: json(documentResponseSchema),
  status: 202,
  errors: ['FORBIDDEN', 'NOT_FOUND', 'RETRY_CONFLICT'],
  invalid: 'NOT_FOUND',
  // Прежняя классификация: повтор не проверен как безопасный; ключ в v1 для этой команды не вводится.
  idempotency: 'none',
});
