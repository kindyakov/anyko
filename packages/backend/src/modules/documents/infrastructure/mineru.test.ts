import { expect, test } from 'bun:test';

import { strToU8, zipSync } from 'fflate';

import { documentImageLimit } from '../../../platform/document-output';

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
          'pdf-ocr.json': strToU8(
            JSON.stringify({
              version: 1,
              pages: [
                {
                  page: 1,
                  omittedLines: 0,
                  lines: [
                    {
                      text: 'Уведомление',
                      confidence: 0.95,
                      bbox: [0.1, 0.2, 0.8, 0.3],
                    },
                  ],
                },
              ],
            }),
          ),
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
      processorVersion: 'mineru-4.1.7+eslav.1',
      pdfOcr: {
        version: 1,
        pages: [
          {
            page: 1,
            omittedLines: 0,
            lines: [
              {
                text: 'Уведомление',
                confidence: 0.95,
                bbox: [0.1, 0.2, 0.8, 0.3],
              },
            ],
          },
        ],
      },
      images: [{ path: 'images/a.png', contentType: 'image/png', bytes: png }],
    });
    await parser.eraseAttempt(identity);
    expect(erased).toBe(true);
  } finally {
    await server.stop(true);
  }
});
test('a successful response from the old processor is rejected for PDF', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () =>
      new Response(zipSync({ 'markdown.md': strToU8('1, 26.2') }), {
        headers: { 'x-mineru-version': '4.1.7' },
      }),
  });
  try {
    const parser = createMineruParser({
      baseUrl: 'http://127.0.0.1:' + String(server.port),
      timeoutMs: 1000,
    });
    await rejected(
      parser.parseDocument(pdf, 'pdf', identity),
      'MINERU_PDF_OCR_OUTDATED',
    );
    expect(
      (await parser.parseDocument(pdf, 'docx', identity)).processorVersion,
    ).toBe('mineru-4.1.7');
  } finally {
    await server.stop(true);
  }
});

test('invalid ZIP and mislabeled rasters never become published artifacts', async () => {
  for (const archive of [
    strToU8('invalid ZIP'),
    zipSync({ 'markdown.md': pdf, 'images/a.png': strToU8('<svg/>') }),
    zipSync({
      'markdown.md': pdf,
      'pdf-ocr.json': strToU8('{"version":1,"pages":[{"page":0}]}'),
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
test('accepts the full image count and reports distinct archive or embedded-format limits', async () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const images = Object.fromEntries(
    Array.from({ length: documentImageLimit }, (_, index) => [
      `images/${String(index)}.png`,
      png,
    ]),
  );
  let response = () =>
    new Response(zipSync({ 'markdown.md': pdf, ...images }), {
      headers: { 'x-mineru-version': '4.1.7' },
    });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => response(),
  });
  try {
    const parser = createMineruParser({
      baseUrl: server.url.href,
      timeoutMs: 3000,
    });
    const parse = () => parser.parseDocument(pdf, 'docx', identity);
    expect((await parse()).images).toHaveLength(documentImageLimit);
    response = () =>
      new Response(
        zipSync({ 'markdown.md': pdf, ...images, 'images/extra.png': png }),
        { headers: { 'x-mineru-version': '4.1.7' } },
      );
    await rejected(parse(), 'MINERU_TOO_MANY_IMAGES');
    response = () =>
      new Response(
        zipSync({
          'markdown.md': pdf,
          'images/large.png': new Uint8Array(3 * 1024 * 1024 + 1),
        }),
        { headers: { 'x-mineru-version': '4.1.7' } },
      );
    await rejected(parse(), 'MINERU_RESULT_TOO_LARGE');
    response = () =>
      new Response('ignored', {
        status: 422,
        headers: { 'x-anyko-processor-error': 'UNSUPPORTED_DOCUMENT_VISUAL' },
      });
    await rejected(parse(), 'MINERU_UNSUPPORTED_EMBEDDED_IMAGE');
  } finally {
    await server.stop(true);
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
