import { expect, test } from 'bun:test';
import { zipSync, strToU8 } from 'fflate';
import { createMineruParser } from './mineru';
const identity = '00000000-0000-4000-8000-000000000001';
const pdf = strToU8('%PDF-1.7 synthetic');
async function rejected(operation: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(String(caught)).toContain(code);
}
test('stateless SDK protocol sends a durable attempt ID, raw input, and erases its workspace', async () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  let erased = false;
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      expect(new URL(request.url).pathname).toBe(`/v1/attempts/${identity}`);
      if (request.method === 'DELETE') {
        erased = true;
        return new Response(null, { status: 204 });
      }
      expect(request.method).toBe('PUT');
      expect(new URL(request.url).searchParams.get('format')).toBe('pdf');
      expect(new Uint8Array(await request.arrayBuffer())).toEqual(pdf);
      return new Response(
        zipSync({
          'markdown.md': strToU8('![figure](images/a.png)'),
          'images/a.png': png,
        }),
        { headers: { 'x-mineru-version': '4.1.7' } },
      );
    },
  });
  try {
    const parser = createMineruParser({
      baseUrl: `http://127.0.0.1:${String(server.port)}`,
      timeoutMs: 1000,
    });
    expect(await parser.parseDocument(pdf, 'pdf', identity)).toEqual({
      markdown: '![figure](images/a.png)',
      processorVersion: 'mineru-4.1.7',
      images: [{ path: 'images/a.png', contentType: 'image/png', bytes: png }],
    });
    await parser.eraseAttempt(identity);
    expect(erased).toBe(true);
  } finally {
    await server.stop(true);
  }
});
test('invalid ZIP, mislabeled raster and oversized image never become published artifacts', async () => {
  for (const archive of [
    strToU8('invalid ZIP'),
    zipSync({ 'markdown.md': pdf, 'images/a.png': strToU8('<svg/>') }),
    zipSync({
      'markdown.md': pdf,
      'images/a.png': new Uint8Array(3 * 1024 * 1024 + 1),
    }),
  ]) {
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () =>
        new Response(archive, { headers: { 'x-mineru-version': '4.1.7' } }),
    });
    try {
      await rejected(
        createMineruParser({
          baseUrl: `http://127.0.0.1:${String(server.port)}`,
          timeoutMs: 1000,
        }).parseDocument(pdf, 'pdf', identity),
        'MINERU_INVALID_RESPONSE',
      );
    } finally {
      await server.stop(true);
    }
  }
});
test('unavailable erasure is pending; provider errors never disclose raw bodies', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => new Response('private provider data', { status: 500 }),
  });
  try {
    const parser = createMineruParser({
      baseUrl: `http://127.0.0.1:${String(server.port)}`,
      timeoutMs: 1000,
    });
    await rejected(
      parser.parseDocument(pdf, 'docx', identity),
      'MINERU_FAILED',
    );
    await rejected(parser.eraseAttempt(identity), 'MINERU_ERASURE_PENDING');
  } finally {
    await server.stop(true);
  }
});
test('parse has a bounded HTTP deadline', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch() {
      await Bun.sleep(200);
      return new Response(null);
    },
  });
  try {
    await rejected(
      createMineruParser({
        baseUrl: `http://127.0.0.1:${String(server.port)}`,
        timeoutMs: 20,
      }).parseDocument(pdf, 'pdf', identity),
      'MINERU_TIMEOUT',
    );
  } finally {
    await server.stop(true);
  }
});
