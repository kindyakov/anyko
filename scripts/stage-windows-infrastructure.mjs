import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 is required');
}
const downloads = resolve(
  process.env.ANYKO_WINDOWS_DOWNLOADS ?? 'work/windows-downloads',
);
const output = resolve(
  process.env.ANYKO_WINDOWS_INFRA_OUTPUT ?? 'work/windows-infrastructure',
);
const sources = [
  {
    name: 'postgresql-18.6.zip',
    url: 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip',
    sha256: 'e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2',
    directory: 'postgresql',
  },
  {
    name: 'redis.zip',
    url: 'https://github.com/redis-windows/redis-windows/releases/download/8.10.3/Redis-8.10.3-Windows-x64-msys2.zip',
    sha256: 'af16df340525b431e9ec8dabfd625d5e7a233f82805b5418819904ea909c447f',
    directory: 'redis',
  },
  {
    name: 'rustfs.zip',
    url: 'https://github.com/rustfs/rustfs/releases/download/1.0.1/rustfs-windows-x86_64-v1.0.1.zip',
    sha256: '624259622524255d0000131e095f37a11299fd76926aabfd8f831a9dbe6a39f7',
    directory: 'rustfs',
  },
];

await mkdir(downloads, { recursive: true });
for (const source of sources) {
  const archive = resolve(downloads, source.name);
  let exists = true;
  try {
    await access(archive);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    exists = false;
  }
  if (!exists) {
    const temporary = await mkdtemp(resolve(downloads, '.download-'));
    const partial = resolve(temporary, source.name);
    try {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(300000),
      });
      if (!response.ok || !response.body)
        throw new Error(`Download failed: ${source.name}`);
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(partial, { flags: 'wx' }),
      );
      const downloaded = createHash('sha256');
      for await (const chunk of createReadStream(partial))
        downloaded.update(chunk);
      if (downloaded.digest('hex') !== source.sha256)
        throw new Error(`Checksum mismatch: ${source.name}`);
      // The cache filename is never replaced by this process.
      try {
        await link(partial, archive);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(archive)) digest.update(chunk);
  if (digest.digest('hex') !== source.sha256)
    throw new Error(`Checksum mismatch: ${source.name}`);
}
// Each build has its own directory. Only the completion marker makes it usable.
await mkdir(output, { recursive: true });
const staging = await mkdtemp(resolve(output, 'build-'));
for (const source of sources) {
  const archive = resolve(downloads, source.name);
  const destination = resolve(staging, source.directory);
  await mkdir(destination);
  const extraction = Bun.spawn(['tar.exe', '-xf', archive, '-C', destination], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await extraction.exited) !== 0)
    throw new Error(`Extraction failed: ${source.name}`);
  console.log(`Staged ${source.directory}`);
}
await writeFile(
  resolve(staging, 'complete.json'),
  JSON.stringify({ format: 1 }),
);
console.log(`Infrastructure ready: ${staging}`);
