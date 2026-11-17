import { endpoint, json } from '../common';

import {
  llmSettingsInputSchema,
  llmSettingsResponseSchema,
  savedStatusSchema,
} from './schemas';

export const getLlmSettings = endpoint({
  method: 'GET',
  path: '/settings/llm',
  response: json(llmSettingsResponseSchema),
  status: 200,
  errors: [],
});

export const saveLlmSettings = endpoint({
  method: 'POST',
  path: '/settings/llm',
  body: json(llmSettingsInputSchema),
  response: json(savedStatusSchema),
  status: 200,
  // Право owner проверяет маршрут до разбора тела (guard), поэтому FORBIDDEN объявлен здесь.
  errors: ['FORBIDDEN', 'INVALID_WORK_INPUT'],
  invalid: 'INVALID_WORK_INPUT',
  idempotent: false,
});
