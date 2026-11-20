import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// PDF.js requests these packaged assets by their original names from its worker.
const assetTypes = new Map([
  ['cmaps', new Map([['bcmap', 'application/octet-stream']])],
  [
    'standard_fonts',
    new Map([
      ['pfb', 'application/octet-stream'],
      ['ttf', 'font/ttf'],
    ]),
  ],
  ['iccs', new Map([['icc', 'application/octet-stream']])],
  [
    'wasm',
    new Map([
      ['wasm', 'application/wasm'],
      ['js', 'text/javascript'],
    ]),
  ],
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; file: string }> },
) {
  const { kind, file } = await params;
  const extension = /^[a-z\w-]+\.([a-z]+)$/i.exec(file)?.[1];
  const type = extension && assetTypes.get(kind)?.get(extension);
  if (!type) return new Response(null, { status: 404 });

  const require = createRequire(join(process.cwd(), 'package.json'));
  try {
    const root = dirname(require.resolve('pdfjs-dist/package.json'));
    const bytes = await readFile(join(root, kind, file));
    return new Response(bytes, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
    return new Response(null, { status: 404 });
  }
}
