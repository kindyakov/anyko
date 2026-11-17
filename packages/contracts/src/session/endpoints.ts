import { endpoint, json } from '../common';

import { sessionResponseSchema } from './schemas';

// Сессия без рабочей области: участия пользователя перечислены в ответе.
export const getSession = endpoint({
  method: 'GET',
  path: '/session',
  response: json(sessionResponseSchema),
  status: 200,
  errors: [],
});
