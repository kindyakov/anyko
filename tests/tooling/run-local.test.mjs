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
import { createTerminalLog } from '../../scripts/terminal-log.mjs';

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

test('terminal displays split JSON events with level colors and preserves other output', () => {
  let result = '';
  const terminal = createTerminalLog({
    write: (chunk) => {
      result += chunk;
    },
  });
  const input = Buffer.from(
    '{"level":30,"time":"2026-11-08T18:36:29.165Z","service":"api","event":"process_ready","port":3021}\nplain output\n',
  );
  terminal.write(input.subarray(0, 23));
  terminal.write(input.subarray(23));
  terminal.end();
  expect(result).toContain('\x1b[32mINFO\x1b[0m [api] process_ready port=3021');
  expect(result).toEndWith('plain output\n');
});

test('terminal escapes control characters and preserves oversized and unfinished lines', () => {
  let result = '';
  const terminal = createTerminalLog(
    {
      write: (chunk) => {
        result += chunk;
      },
    },
    { color: false, maxLine: 100 },
  );
  terminal.write(
    Buffer.from('{"level":50,"service":"api","event":"bad\\u001b[31m"}\n'),
  );
  terminal.write(Buffer.from('x'.repeat(120)));
  terminal.write(Buffer.from(' tail\nunfinished'));
  terminal.end();
  expect(result).toContain('ERROR [api] bad\\u001b[31m');
  expect(result).not.toContain('\x1b');
  expect(result).toEndWith(`${'x'.repeat(120)} tail\nunfinished`);
});
