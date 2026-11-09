if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Windows x64 is required');
}
const build = Bun.spawn([process.execPath, 'run', 'build'], {
  env: { ...process.env, ANYKO_WINDOWS_BUILD: 'true' },
  stdout: 'inherit',
  stderr: 'inherit',
});
if ((await build.exited) !== 0) throw new Error('Web build failed');
const stage = Bun.spawn([process.execPath, 'scripts/stage-windows-web.mjs'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
if ((await stage.exited) !== 0) throw new Error('Web staging failed');
