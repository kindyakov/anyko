import { endpoint, json } from '../common';

import { packagesResponseSchema } from './schemas';

export const listDocumentPackages = endpoint({
  summary: 'Возвращает каталог пакетов документов',
  method: 'GET',
  path: '/document-packages',
  response: json(packagesResponseSchema),
  status: 200,
  errors: [],
});
