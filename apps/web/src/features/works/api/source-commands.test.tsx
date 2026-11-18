import { expect, test } from 'bun:test';

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';

import { createQueryClient } from '@/lib/api/query-client';

import { json, serveApi } from '../../../../test/api';
import { workId, workspaceId, workView } from '../../../../test/fixtures';

import {
  type Upload,
  uploadWorkFiles,
  useUpdateWorkDocumentRecognition,
  useUploadWorkDocument,
} from './source-commands';
import { useWorkCommands } from './use-work-commands';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const documentsAddress = `/api/v1/workspaces/${workspaceId}/works/${workId}/documents`;

test('each file of an upload gets its own idempotency key, and a refused file does not stop the next one', async () => {
  const exchanges = serveApi((exchange) => {
    const file =
      exchange.body instanceof FormData ? exchange.body.get('file') : null;
    if (file instanceof File && file.name === 'scheme.spl7')
      return new Response(
        JSON.stringify({
          error: { code: 'UNSUPPORTED_DOCUMENT_FORMAT', requestId: 'r1' },
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'r1',
          },
        },
      );
    return json(202, {
      document: {
        id: 'd1',
        filename: 'passport.pdf',
        status: 'queued',
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    });
  });
  const { result } = renderHook(
    () => {
      const [uploads, setUploads] = useState<Upload[]>([]);
      const upload = useUploadWorkDocument(workspaceId, workId);
      return { uploads, setUploads, upload };
    },
    { wrapper: wrapperFor(createQueryClient()) },
  );

  await act(async () => {
    const accepted = await uploadWorkFiles(
      [
        new File(['%PDF'], 'scheme.spl7'),
        new File(['%PDF'], 'passport.pdf', { type: 'application/pdf' }),
      ],
      async (file, idempotencyKey) => {
        await result.current.upload.mutateAsync({ file, idempotencyKey });
        return true;
      },
      result.current.setUploads,
    );
    expect(accepted).toBe(1);
  });

  const posts = exchanges.filter((item) => item.method === 'POST');
  expect(posts.map((item) => item.url)).toEqual([
    documentsAddress,
    documentsAddress,
  ]);
  const [refused, accepted] = posts;
  expect(refused?.idempotencyKey).toBeTruthy();
  expect(accepted?.idempotencyKey).toBeTruthy();
  expect(accepted?.idempotencyKey).not.toBe(refused?.idempotencyKey);

  const [first, second] = result.current.uploads;
  expect(first?.state).toBe('failed');
  expect(first?.reason).toContain('scheme.spl7: Поддерживаются PDF');
  expect(first?.reason).toContain('Код обращения: r1.');
  expect(second?.state).toBe('done');
});

test('an OCR revision request blocks other work commands and refreshes a conflicting work view', async () => {
  const client = createQueryClient();
  const workKey = ['works', workspaceId, 'detail', workId];
  client.setQueryData(workKey, workView);
  const response = Promise.withResolvers<Response>();
  serveApi(() => response.promise);
  const { result } = renderHook(
    () => ({
      revision: useUpdateWorkDocumentRecognition(workspaceId, workId),
      commands: useWorkCommands(workspaceId, workView, false),
    }),
    { wrapper: wrapperFor(client) },
  );

  try {
    act(() => {
      result.current.revision.mutate({
        documentId: crypto.randomUUID(),
        ocrRevision: 2,
      });
    });
    await waitFor(() => {
      expect(result.current.revision.isPending).toBe(true);
    });
    expect(result.current.commands.pending).toBe(true);
    expect(result.current.commands.disabled.analyze).toBe(true);
    expect(result.current.commands.editingBlocked).toBe(true);
  } finally {
    response.resolve(
      json(409, { error: { code: 'REVISION_CONFLICT', requestId: 'fixture' } }),
    );
    await waitFor(() => {
      expect(result.current.revision.isError).toBe(true);
    });
  }
  expect(result.current.commands.pending).toBe(false);
  expect(client.getQueryState(workKey)?.isInvalidated).toBe(true);
});
