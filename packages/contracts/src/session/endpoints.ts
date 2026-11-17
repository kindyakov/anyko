import { endpoint, json } from '../common';

import { sessionResponseSchema } from './schemas';

export const getSession = endpoint({
  method: 'GET',
  path: '/session',
  response: json(sessionResponseSchema),
  status: 200,
  errors: [],
});
