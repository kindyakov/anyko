import { z } from 'zod';

import { endpoint, json, workspaceParams } from '../common';

import {
  llmSettingsInputSchema,
  llmSettingsResponseSchema,
  savedStatusSchema,
} from './schemas';

export const getLlmSettings = endpoint({
  summary: 'Возвращает настройки подключения языковой модели',
  method: 'GET',
  path: '/workspaces/:workspaceId/connections/llm',
  params: workspaceParams,
  response: json(llmSettingsResponseSchema),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
});

export const saveLlmSettings = endpoint({
  summary: 'Сохраняет настройки подключения языковой модели',
  method: 'PATCH',
  path: '/workspaces/:workspaceId/connections/llm',
  params: workspaceParams,
  body: json(llmSettingsInputSchema),
  response: json(savedStatusSchema),
  status: 200,
  // Право connections.manage проверяет сценарий после разбора тела (ADR 0009).
  errors: ['FORBIDDEN', 'NOT_FOUND', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  // Сохранение настроек: повтор с теми же значениями даёт новую ревизию с тем же содержимым.
  idempotency: 'natural',
});

export const revokeLlmSettings = endpoint({
  summary: 'Отзывает подключение языковой модели',
  method: 'DELETE',
  path: '/workspaces/:workspaceId/connections/llm',
  params: workspaceParams,
  response: json(z.object({ status: z.literal('revoked') }).strict()),
  status: 200,
  errors: ['FORBIDDEN', 'NOT_FOUND'],
  invalid: 'NOT_FOUND',
  idempotency: 'natural',
});
