import { expect, test } from 'bun:test';

import { createQueryClient } from '@/lib/api/query-client';

import { json, serveApi } from '../../../../test/api';
import { workId, workspaceId } from '../../../../test/fixtures';

import { documentResultQueryOptions } from './queries';

const result = { markdown: '# Паспорт', processorVersion: 'test', images: [] };

test('a work document result is read through its work, a recognition result directly', async () => {
  const exchanges = serveApi(() => json(200, result));
  const client = createQueryClient();

  await client.query(
    documentResultQueryOptions(workspaceId, 'doc-1', { kind: 'work', workId }),
  );
  await client.query(
    documentResultQueryOptions(workspaceId, 'doc-1', { kind: 'recognition' }),
  );

  expect(exchanges.map((exchange) => exchange.url)).toEqual([
    `/api/v1/workspaces/${workspaceId}/works/${workId}/documents/doc-1/result`,
    `/api/v1/workspaces/${workspaceId}/recognitions/doc-1/result`,
  ]);
});
