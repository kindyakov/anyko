import { expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { createMineruParser } from './mineru';

const pdf = new TextEncoder().encode('%PDF-1.4 synthetic');
const archive = zipSync({ 'markdown.md': strToU8('ANYKO expected text') });

async function withServer(
  scenario: (
    path: string,
    request: Request,
    origin: string,
  ) => Response | Promise<Response>,
  check: (origin: string) => Promise<void> | void,
) {
  let origin = '';
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request) =>
      scenario(new URL(request.url).pathname, request, origin),
  });
  origin = `http://127.0.0.1:${String(server.port)}`;
  try {
    await check(origin);
  } finally {
    await server.stop(true);
  }
}

function receipt(origin: string) {
  return Response.json(
    {
      task_id: 'task-1',
      status: 'waiting-file',
      files: [
        {
          file_id: 'file-1',
          status: 'waiting-file',
          upload: { url: `${origin}/upload`, headers: {} },
        },
      ],
    },
    { status: 202 },
  );
}
function completed(origin: string) {
  return Response.json({
    task_id: 'task-1',
    status: 'completed',
    files: [
      {
        file_id: 'file-1',
        status: 'completed',
        parse: { parser_version: '4.1.7' },
        result_url: `${origin}/result`,
      },
    ],
  });
}

test('V1 tasks uploads bytes once, validates result version and reads only markdown', async () => {
  let uploads = 0;
  await withServer(
    async (path, request, origin) => {
      if (path === '/v1/tasks') {
        const body: unknown = await request.json();
        expect(body).toEqual({
          files: [{ file_name: 'document.pdf', bytes: pdf.length }],
          tier: 'basic',
          ocr_mode: 'auto',
          output_formats: ['default'],
        });
        return receipt(origin);
      }
      if (path === '/upload') {
        uploads++;
        expect(new Uint8Array(await request.arrayBuffer())).toEqual(pdf);
        return Response.json({ status: 'pending' });
      }
      if (path === '/result') return new Response(archive);
      return completed(origin);
    },
    async (origin) => {
      expect(
        await createMineruParser({ baseUrl: origin, timeoutMs: 1000 }).parsePdf(
          pdf,
        ),
      ).toEqual({
        markdown: 'ANYKO expected text',
        processorVersion: 'mineru-4.1.7',
      });
    },
  );
  expect(uploads).toBe(1);
});

test('rejects an upload target outside the configured origin before sending document bytes', async () => {
  let leaked = false;
  await withServer(
    () => {
      leaked = true;
      return new Response(null);
    },
    async (attacker) => {
      await withServer(
        () =>
          Response.json({
            task_id: 'task-1',
            status: 'waiting-file',
            files: [
              {
                file_id: 'file-1',
                status: 'waiting-file',
                upload: { url: `${attacker}/upload`, headers: {} },
              },
            ],
          }),
        (origin) => {
          expect(
            createMineruParser({ baseUrl: origin, timeoutMs: 100 }).parsePdf(
              pdf,
            ),
          ).rejects.toThrow('MINERU_INVALID_RESPONSE');
        },
      );
    },
  );
  expect(leaked).toBe(false);
});

test('does not accept another task/file receipt or disclose provider error bodies', async () => {
  await withServer(
    (path, _request, origin) => {
      if (path === '/v1/tasks') return receipt(origin);
      if (path === '/upload') return new Response(null);
      return Response.json({
        task_id: 'other-task',
        status: 'completed',
        files: [{ file_id: 'other-file', status: 'completed' }],
      });
    },
    (origin) => {
      expect(
        createMineruParser({ baseUrl: origin, timeoutMs: 1000 }).parsePdf(pdf),
      ).rejects.toThrow('MINERU_INVALID_RESPONSE');
    },
  );
  await withServer(
    () => new Response('private provider fixture', { status: 500 }),
    async (origin) => {
      try {
        await createMineruParser({ baseUrl: origin, timeoutMs: 1000 }).parsePdf(
          pdf,
        );
        throw new Error('unexpected success');
      } catch (error) {
        expect(String(error)).toBe('MineruError: MINERU_UNAVAILABLE');
      }
    },
  );
});

test('pending task polling has an overall deadline', async () => {
  await withServer(
    (path, _request, origin) => {
      if (path === '/v1/tasks') return receipt(origin);
      if (path === '/upload') return new Response(null);
      return Response.json({
        task_id: 'task-1',
        status: 'pending',
        files: [{ file_id: 'file-1', status: 'pending' }],
      });
    },
    (origin) => {
      const before = performance.now();
      expect(
        createMineruParser({
          baseUrl: origin,
          timeoutMs: 100,
          pollIntervalMs: 10,
        }).parsePdf(pdf),
      ).rejects.toThrow('MINERU_TIMEOUT');
      expect(performance.now() - before).toBeLessThan(1000);
    },
  );
});

test('failed task and invalid result archive are explicit errors', async () => {
  await withServer(
    (path, _request, origin) => {
      if (path === '/v1/tasks') return receipt(origin);
      if (path === '/upload') return new Response(null);
      return Response.json({
        task_id: 'task-1',
        status: 'failed',
        files: [
          {
            file_id: 'file-1',
            status: 'failed',
            error: { message: 'private fixture' },
          },
        ],
      });
    },
    (origin) => {
      expect(
        createMineruParser({ baseUrl: origin, timeoutMs: 1000 }).parsePdf(pdf),
      ).rejects.toThrow('MINERU_FAILED');
    },
  );
  await withServer(
    (path, _request, origin) => {
      if (path === '/v1/tasks') return receipt(origin);
      if (path === '/upload') return new Response(null);
      if (path === '/result')
        return new Response(
          zipSync({ 'other.md': strToU8('not the contract') }),
        );
      return completed(origin);
    },
    (origin) => {
      expect(
        createMineruParser({ baseUrl: origin, timeoutMs: 1000 }).parsePdf(pdf),
      ).rejects.toThrow('MINERU_INVALID_RESPONSE');
    },
  );
});
