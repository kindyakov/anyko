import {
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required');
const inputs = [
  ['infrastructure', process.env.ANYKO_WINDOWS_INFRA_PATH, 1],
  ['migrator', process.env.ANYKO_WINDOWS_MIGRATOR_PATH, 2],
  ['mineru', process.env.ANYKO_WINDOWS_MINERU_PATH, 1],
];
for (const [name, input, version] of inputs) {
  if (
    !input ||
    JSON.parse(await readFile(resolve(input, 'complete.json'), 'utf8'))
      .format !== version
  ) {
    throw new Error(`Missing completed ${name} build`);
  }
}
const web = resolve(process.env.ANYKO_WINDOWS_WEB_OUTPUT ?? 'work/windows-web');
await lstat(resolve(web, 'junctions.json'));
const components = resolve(
  process.env.ANYKO_WINDOWS_COMPONENTS_OUTPUT ?? 'work/windows-components',
);
for (const name of ['api', 'worker', 'prepare-storage', 'provision-access']) {
  await lstat(resolve(components, `anyko-${name}.exe`));
}
const output = resolve(
  process.env.ANYKO_WINDOWS_RELEASE_OUTPUT ?? 'work/windows-release',
);
await mkdir(output, { recursive: true });
const container = await mkdtemp(resolve(output, 'build-'));
const stage = resolve(container, 'Anyko');
await mkdir(stage);
async function copyClean(source, destination) {
  await cp(source, destination, {
    recursive: true,
    filter: async (path) => {
      if ((await lstat(path)).isSymbolicLink())
        throw new Error(`Unexpected link in release source: ${path}`);
      return true;
    },
  });
}
for (const [name, input] of inputs)
  await copyClean(resolve(input), resolve(stage, name));
await copyClean(web, resolve(stage, 'web'));
await mkdir(resolve(stage, 'components'));
for (const name of ['api', 'worker', 'prepare-storage', 'provision-access']) {
  await copyFile(
    resolve(components, `anyko-${name}.exe`),
    resolve(stage, 'components', `anyko-${name}.exe`),
  );
}
await copyFile('infra/windows/launcher.py', resolve(stage, 'launcher.py'));
await copyFile(
  'infra/windows/serve_processor.py',
  resolve(stage, 'mineru/serve_processor.py'),
);
await copyFile('infra/windows/README.txt', resolve(stage, 'README.txt'));
await copyClean('infra/windows/licenses', resolve(stage, 'licenses'));
await copyFile('bun.lock', resolve(stage, 'licenses/bun.lock'));
await copyFile(
  'infra/mineru/requirements-windows.lock',
  resolve(stage, 'licenses/requirements-windows.lock'),
);
// Include notices from all installed Bun package copies, including packages
// bundled into executables. Keep source paths in the index for attribution.
const noticeRoot = resolve(stage, 'licenses/javascript');
await mkdir(noticeRoot);
const noticeIndex = [];
let noticeNumber = 0;
async function collectNotices(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectNotices(path);
    } else if (
      entry.isFile() &&
      /^(licen[cs]e|copying|notice)([.-].*)?$/i.test(entry.name)
    ) {
      const target = `${String(++noticeNumber).padStart(6, '0')}.txt`;
      await copyFile(path, resolve(noticeRoot, target));
      noticeIndex.push(
        `${target}\t${path.slice(resolve('node_modules').length + 1)}`,
      );
    }
  }
}
await collectNotices(resolve('node_modules/.bun'));
if (!noticeNumber) throw new Error('No JavaScript dependency notices found');
await writeFile(
  resolve(noticeRoot, 'INDEX.txt'),
  noticeIndex.join('\n') + '\n',
);
const build = Bun.spawn(
  [
    process.execPath,
    'build',
    '--compile',
    '--no-compile-autoload-dotenv',
    '--no-compile-autoload-bunfig',
    'infra/windows/bootstrap.mjs',
    '--outfile',
    resolve(stage, 'Anyko.exe'),
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);
if ((await build.exited) !== 0) throw new Error('Launcher compilation failed');
await writeFile(resolve(stage, 'complete.json'), JSON.stringify({ format: 1 }));
console.log(`Windows release ready: ${stage}`);
