import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required');
if (!process.env.ANYKO_WINDOWS_MINERU_PATH)
  throw new Error('Set path to completed MinerU build');
const source = resolve(process.env.ANYKO_WINDOWS_MINERU_PATH);
const metadata = JSON.parse(
  await readFile(resolve(source, 'complete.json'), 'utf8'),
);
if (
  metadata.format !== 2 ||
  typeof metadata.python !== 'string' ||
  isAbsolute(metadata.python)
)
  throw new Error('Incomplete MinerU build');
const temporary = await mkdtemp(join(tmpdir(), 'anyko-ocr-smoke-'));
const root = resolve(temporary, 'mineru');
const python = resolve(root, metadata.python);
const pythonRelative = relative(root, python);
if (
  !pythonRelative ||
  pythonRelative === '..' ||
  pythonRelative.startsWith(`..${sep}`) ||
  isAbsolute(pythonRelative)
)
  throw new Error('Invalid Python path');
let server;
let attempted;
let endpoint;
try {
  await cp(source, root, { recursive: true });
  const appdata = resolve(temporary, 'appdata');
  await mkdir(appdata);
  const env = {
    SystemRoot: process.env.SystemRoot,
    PATH: resolve(process.env.SystemRoot, 'System32'),
    TEMP: temporary,
    TMP: temporary,
    USERPROFILE: temporary,
    APPDATA: appdata,
    LOCALAPPDATA: appdata,
    MINERU_HOME: resolve(root, 'home'),
    HF_HOME: resolve(temporary, 'hf'),
    HF_HUB_OFFLINE: '1',
    HF_HUB_DISABLE_XET: '1',
    MINERU_TELEMETRY_DISABLED: '1',
    ANYKO_PROCESSOR_ROOT: resolve(temporary, 'jobs'),
  };
  const fixture = resolve(temporary, 'synthetic.pdf');
  const generate = Bun.spawn(
    [
      python,
      '-c',
      "from PIL import Image,ImageDraw,ImageFont; import sys; im=Image.new('RGB',(1200,400),'white'); d=ImageDraw.Draw(im); f=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',46); d.text((50,60),'Уведомление о налоговом режиме',font=f,fill='black'); d.text((50,150),'Форма 1150001. Год 2023',font=f,fill='black'); im.save(sys.argv[1],format='PDF',resolution=150)",
      fixture,
    ],
    { cwd: temporary, env, stdout: 'ignore', stderr: 'inherit' },
  );
  if ((await generate.exited) !== 0)
    throw new Error('Synthetic PDF generation failed');
  const socket = createServer();
  await new Promise((done, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', done);
  });
  const port = socket.address().port;
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  endpoint = `http://127.0.0.1:${port}`;
  server = Bun.spawn(
    [
      python,
      '-B',
      '-m',
      'uvicorn',
      'processor:app',
      '--app-dir',
      root,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--workers',
      '1',
      '--log-level',
      'warning',
      '--no-access-log',
    ],
    { cwd: temporary, env, stdout: 'ignore', stderr: 'ignore' },
  );
  let health;
  for (let i = 0; i < 300; i++) {
    if (server.exitCode !== null)
      throw new Error('MinerU exited before readiness');
    try {
      const response = await fetch(`${endpoint}/v1/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) {
        health = await response.json();
        break;
      }
    } catch {
      /* Starting. */
    }
    await Bun.sleep(200);
  }
  if (!health) throw new Error('MinerU did not become ready');
  if (
    health.ocrRecognizer?.model !== 'cyrillic_PP-OCRv5_rec_mobile.onnx' ||
    health.ocrRecognizer?.sha256 !==
      '90f761b4bfcce0c8c561c0cb5c887b0971d3ec01c32164bdf7374a35b0982711'
  )
    throw new Error('Unexpected OCR recognizer in MinerU health');
  attempted = `${endpoint}/v1/attempts/${randomUUID()}`;
  const result = await fetch(`${attempted}?format=pdf`, {
    method: 'PUT',
    body: await Bun.file(fixture).bytes(),
    signal: AbortSignal.timeout(300000),
  });
  if (!result.ok) throw new Error(`OCR failed with status ${result.status}`);
  if (
    result.headers.get('content-type') !== 'application/zip' ||
    result.headers.get('x-mineru-version') !== '4.1.7+cyrillic-pdf.1'
  )
    throw new Error('Unexpected MinerU PDF response contract');
  const zip = resolve(temporary, 'result.zip');
  await writeFile(zip, new Uint8Array(await result.arrayBuffer()));
  const inspect = Bun.spawn(
    [
      python,
      '-c',
      String.raw`
import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    entries = archive.namelist()
    assert entries.count('markdown.md') == 1
    assert entries.count('pdf-ocr.json') <= 1
    text = archive.read('markdown.md').decode('utf-8').casefold().replace(r'\.', '.')
    assert 'уведомление о налоговом режиме' in text
    assert 'форма 1150001. год 2023' in text
    if 'pdf-ocr.json' in entries:
        metadata = json.loads(archive.read('pdf-ocr.json'))
        assert metadata['version'] == 1 and isinstance(metadata['pages'], list)
        assert all(page['page'] == 1 for page in metadata['pages'])
`,
      zip,
    ],
    { cwd: temporary, env, stdout: 'ignore', stderr: 'inherit' },
  );
  if ((await inspect.exited) !== 0) throw new Error('OCR marker missing');
  console.log(
    'Relocated offline Cyrillic processor recognized the Russian synthetic PDF',
  );
} finally {
  let cleanupError;
  if (server && server.exitCode === null) {
    try {
      if (attempted) {
        const deleted = await fetch(attempted, {
          method: 'DELETE',
          signal: AbortSignal.timeout(300000),
        });
        if (!deleted.ok) throw new Error('Processor cleanup failed');
      }
    } catch (error) {
      cleanupError = error;
    }
    server.kill();
    await server.exited;
  }
  if (cleanupError) {
    console.error(
      `Processor cleanup failed; temporary files retained at ${temporary}`,
    );
    throw cleanupError;
  }
  // Python's extended-length Windows paths remove deep package trees that Bun
  // cannot always remove on Windows. The directory is the one mkdtemp made.
  const cleanup = Bun.spawn(
    [
      'python',
      '-c',
      'import shutil,sys; shutil.rmtree(sys.argv[1])',
      win32.toNamespacedPath(temporary),
    ],
    { stdout: 'ignore', stderr: 'inherit' },
  );
  if ((await cleanup.exited) !== 0)
    throw new Error(`Temporary OCR cleanup failed: ${temporary}`);
}
