import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { resolve, sep } from 'node:path';
import { createLogWriter, parseLaunchArgs } from '../../scripts/run-local.mjs';

const work = resolve('work');
const directories = [];
function logFile() {
  mkdirSync(work, { recursive: true });
  const directory = mkdtempSync(resolve(work, 'local-log-test-'));
  directories.push(directory);
  return resolve(directory, 'runtime.log');
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(work + sep))
      throw new Error('Unsafe test cleanup');
    rmSync(directory, { recursive: true });
  }
});

test('local launch accepts only fixed app and mode pairs', () => {
  expect(parseLaunchArgs(['api', 'dev'])).toEqual({ app: 'api', mode: 'dev' });
  expect(parseLaunchArgs(['worker', 'start'])).toEqual({
    app: 'worker',
    mode: 'start',
  });
  for (const args of [
    [],
    ['web', 'start'],
    ['api;echo', 'dev'],
    ['api', '--eval'],
    ['api', 'dev', 'extra'],
  ]) {
    expect(() => parseLaunchArgs(args)).toThrow('Usage:');
  }
});

test('invalid CLI exits before launching an app', () => {
  const result = spawnSync(
    process.execPath,
    [resolve('scripts/run-local.mjs'), 'foreign', 'start'],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('Usage:');
});

test('file logging appends across launcher restarts', () => {
  const file = logFile();
  createLogWriter(file).write(Buffer.from('first\n'));
  createLogWriter(file).write(Buffer.from('second\n'));
  expect(readFileSync(file, 'utf8')).toBe('first\nsecond\n');
});

test('rotation keeps bounded bytes and exactly the newest three backups', () => {
  const file = logFile();
  createLogWriter(file, { maxBytes: 4, backups: 3 }).write(
    'abcdefghijklmnopqrst',
  );
  expect(readFileSync(file, 'utf8')).toBe('qrst');
  expect(readFileSync(`${file}.1`, 'utf8')).toBe('mnop');
  expect(readFileSync(`${file}.2`, 'utf8')).toBe('ijkl');
  expect(readFileSync(`${file}.3`, 'utf8')).toBe('efgh');
  expect(existsSync(`${file}.4`)).toBe(false);
});

test('restarted writer rotates when existing file reaches its limit', () => {
  const file = logFile();
  createLogWriter(file, { maxBytes: 4 }).write('1234');
  createLogWriter(file, { maxBytes: 4 }).write('5');
  expect(readFileSync(`${file}.1`, 'utf8')).toBe('1234');
  expect(readFileSync(file, 'utf8')).toBe('5');
});

test('invalid rotation configuration fails explicitly', () => {
  const file = logFile();
  expect(() => createLogWriter(file, { maxBytes: 0 })).toThrow('rotation');
  expect(() => createLogWriter(file, { backups: 0 })).toThrow('rotation');
});
